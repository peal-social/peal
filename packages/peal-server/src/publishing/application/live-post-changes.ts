import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Result,
  Semaphore,
} from "effect";

import type { BodyProblem } from "#publishing/domain/body-problem.ts";
import { ChannelOptions } from "#publishing/domain/channel-options.ts";
import type { ChannelOnPlatform } from "#publishing/domain/content-rules.ts";
import type { ContentViolation } from "#publishing/domain/content-violation.ts";
import { LivePostChangeIdSchema } from "#publishing/domain/live-post-change-id.ts";
import {
  editable,
  livePostChangePermission,
  removable,
  requestEdit,
  requestUnpublish,
} from "#publishing/domain/live-post-change.ts";
import type {
  LivePostChange,
  LivePostRefusal,
} from "#publishing/domain/live-post-change.ts";
import {
  editViolationsOn,
  siteContentOn,
  siteEditViolationsOn,
  withSiteStatusKept,
  withEditOn,
} from "#publishing/domain/live-post-edit.ts";
import { deletionWindowPassed } from "#publishing/domain/live-post-support.ts";
import { PostContentRejected } from "#publishing/domain/post-content-rejected.ts";
import { textOn } from "#publishing/domain/post-content.ts";
import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { PostTarget } from "#publishing/domain/post-target.ts";
import { maxPostTextLength } from "#publishing/domain/post-text.ts";
import type { Post } from "#publishing/domain/post.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { newId } from "#shared/application/ids.ts";
import type { Ids } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { PostId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import { storableText } from "#shared/domain/platform-text.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import { textOfBody } from "#shared/domain/rich-text/rich-body.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

import { ApprovalGate } from "./approval-gate.ts";
import type { AttachableMedia } from "./attachable-media.ts";
import { LivePostChangeStore } from "./live-post-change-store.ts";
import { LivePostHolds } from "./live-post-holds.ts";
import { LivePostJobs } from "./live-post-jobs.ts";
import { LivePostNotChangeable } from "./live-post-not-changeable.ts";
import { PlatformCredentials } from "./platform-credentials.ts";
import { PostNotFound } from "./post-not-found.ts";
import { PostOrigins } from "./post-origins.ts";
import { maxOutcomeWait, maxWaitingRequests } from "./post-outcomes.ts";
import { mediaFor } from "./post-references.ts";
import { PostRepository } from "./post-repository.ts";
import { SiteFiles } from "./site-files.ts";
import type { UnknownMedia } from "./unknown-media.ts";
import { findInWorkspace, lockInWorkspace } from "./workspace-posts.ts";

// How often a waiting request reads the change again.
const readEvery = Duration.millis(500);

type Failure =
  | DatabaseError
  | LivePostNotChangeable
  | MissingPermission
  | PostNotFound;

/** A rich text a request gave that does not decode (`bodyInvalid`). */
export const invalidBody = "invalidBody";

/**
 * What an edit asks: `text` for the part at `part` (from 0, the post
 * itself) on the target's channel; on a website, its text or a rich text
 * (`body`, or `invalidBody` for one that did not decode) and its options,
 * whole, each kept when left out. A social target takes `text` alone.
 */
export interface TextEditRequest {
  readonly body?: ArticleBody | typeof invalidBody;
  /** Why a body sent as Markdown is `invalidBody`, with their places. */
  readonly bodyProblems?: readonly BodyProblem[];
  readonly options?: TargetOptions;
  readonly part: number;
  readonly text?: string;
}

// Fails as scheduling does when there is a violation.
const rejected = (violations: readonly ContentViolation[]) => {
  const [first, ...others] = violations;

  return first === undefined
    ? Effect.void
    : Effect.fail(new PostContentRejected({ violations: [first, ...others] }));
};

// A rich text the edit gives where none is taken, or that does not
// decode, named on the target's channel and the part asked.
const bodyViolation = (
  tag: "bodyInvalid" | "bodyNotTaken",
  channel: ChannelOnPlatform,
  part: number,
  problems?: readonly BodyProblem[]
): ContentViolation => {
  if (tag === "bodyInvalid") {
    const at =
      part === 0
        ? { _tag: tag, channelId: channel.channelId }
        : { _tag: tag, channelId: channel.channelId, part };

    return problems === undefined ? at : { ...at, problems };
  }

  const named = { channelId: channel.channelId, platform: channel.platform };

  return part === 0 ? { _tag: tag, ...named } : { _tag: tag, ...named, part };
};

// An edit as checked, as its change holds it: every edit's text (a
// website's rich text's plain text, or the text the channel has when only
// its options change), a website's rich text and its new options.
interface AskedEdit {
  readonly body: Option.Option<ArticleBody>;
  readonly options: Option.Option<TargetOptions>;
  readonly text: string;
}

/** A target of the post that could not be unpublished, and why. */
export interface TargetRefusal {
  readonly reason: LivePostRefusal;
  readonly targetId: PostTargetId;
}

/** What asking to unpublish a whole post made, target by target. */
export interface PostUnpublish {
  readonly changes: readonly LivePostChange[];
  readonly refused: readonly TargetRefusal[];
}

/**
 * Changes members, keys and applications ask of posts that are live:
 * deleting them from the platforms (`unpublish`), and replacing the text
 * of one of their parts (`edit`). Each needs `livePostChangePermission`,
 * and is refused, before anything is called, where the target is not
 * live, Peal has no id for a part of it, the platform cannot
 * (`#publishing/domain/live-post-support.ts`), another change is pending,
 * the channel cannot be used, or, for a removal, a boost shows the post;
 * an edit is refused too to a member whose posts the approval gate holds,
 * and for a text the platform would refuse.
 * A change is saved with its job in one transaction, under the post's and
 * the target's locks; the job deletes the parts, the last first. A target
 * that is not the post's, and a post that is not the workspace's, are
 * PostNotFound.
 */
export class LivePostChanges extends Context.Service<
  LivePostChanges,
  {
    /** Deletes the post from one channel's platform, every part of it. */
    readonly unpublishTarget: (
      actor: Actor,
      postId: PostId,
      targetId: PostTargetId
    ) => Effect.Effect<LivePostChange, Failure>;
    /**
     * Replaces the text of one part of the post on one channel's
     * platform, and on a website its rich text and its options; once
     * done, that part's text on the channel is the new one, and a
     * website's options the target's. The text is made storable first.
     */
    readonly editTarget: (
      actor: Actor,
      postId: PostId,
      targetId: PostTargetId,
      edit: TextEditRequest
    ) => Effect.Effect<
      LivePostChange,
      Failure | PostContentRejected | UnknownMedia
    >;
    /**
     * Deletes the post from every channel where it can be, and answers,
     * target by target, the change made or why none could be.
     */
    readonly unpublishPost: (
      actor: Actor,
      postId: PostId
    ) => Effect.Effect<
      PostUnpublish,
      DatabaseError | MissingPermission | PostNotFound
    >;
    /**
     * The change as it stands once it ended, or once `wait` ran out
     * (`maxOutcomeWait` at most), read again every half second: no lock is
     * held while it waits, and the job alone changes it. A process lets
     * `maxWaitingRequests` wait at once; one more is answered at once.
     */
    readonly awaitEnd: (
      change: LivePostChange,
      wait: Duration.Duration
    ) => Effect.Effect<LivePostChange, DatabaseError>;
    /** The post's changes, newest first. Needs post:read. */
    readonly list: (
      actor: Actor,
      postId: PostId
    ) => Effect.Effect<
      readonly LivePostChange[],
      DatabaseError | MissingPermission | PostNotFound
    >;
  }
>()("peal-server/publishing/application/LivePostChanges") {
  static readonly layer = Layer.effect(
    LivePostChanges,
    Effect.gen(function* LivePostChangesLive() {
      const posts = yield* PostRepository;
      const store = yield* LivePostChangeStore;
      const holds = yield* LivePostHolds;
      const jobs = yield* LivePostJobs;
      const gate = yield* ApprovalGate;
      const credentials = yield* PlatformCredentials;
      const origins = yield* PostOrigins;
      const siteFiles = yield* SiteFiles;
      const { transaction } = yield* TransactionRunner;

      const ports = yield* Effect.context<
        AttachableMedia | Ids | PostRepository
      >();

      const waiting = yield* Semaphore.make(maxWaitingRequests);

      // The channel's platform, while it can be used: none once it was
      // disconnected, turned off, or must be reconnected.
      const platformOf = (target: PostTarget) =>
        credentials.account(target.channelId).pipe(
          Effect.map(({ platform }) => Option.some(platform)),
          Effect.catchTags({
            BadRequest: () => Effect.succeedNone,
            // The channels context could not read the channel: the
            // server's own failure, not the channel's.
            PlatformUnavailable: (failure) => Effect.die(failure),
            TokenExpired: () => Effect.succeedNone,
          })
        );

      // Why the locked target cannot be unpublished, or the change that
      // will, saved and started.
      const unpublishLocked = Effect.fn("LivePostChanges.unpublishLocked")(
        function* unpublishLocked(
          actor: Actor,
          post: Post,
          target: PostTarget
        ) {
          const latest = yield* store.latestOf(target.id);
          const lastRemoval = yield* store.latestOf(target.id, "unpublish");
          const platform = yield* platformOf(target);

          const parts = removable(target, platform, latest, lastRemoval);

          if (Result.isFailure(parts)) {
            return Result.fail<LivePostRefusal>(parts.failure);
          }

          // The platform would refuse it: past its deletion window.
          const at = yield* DateTime.now;

          if (
            Option.exists(platform, (on) =>
              deletionWindowPassed(target, on, at)
            )
          ) {
            return Result.fail<LivePostRefusal>("deletionWindowPassed");
          }

          const held = yield* holds.ofTarget({
            postId: post.id,
            targetId: target.id,
            workspaceId: post.workspaceId,
          });

          if (Option.isSome(held)) {
            return Result.fail<LivePostRefusal>(held.value);
          }

          const change = requestUnpublish({
            channelId: target.channelId,
            id: yield* newId(LivePostChangeIdSchema).pipe(
              Effect.provideContext(ports)
            ),
            now: yield* DateTime.now,
            parts: parts.success,
            postId: post.id,
            requestedBy:
              actor.subject._tag === "user"
                ? Option.some(actor.subject.userId)
                : Option.none(),
            requestedVia: Option.some(yield* origins.of(actor)),
            targetId: target.id,
            workspaceId: post.workspaceId,
          });

          if (!(yield* store.insert(change))) {
            return Result.fail<LivePostRefusal>("changeInProgress");
          }

          yield* jobs.start(change.id);

          return Result.succeed(change);
        }
      );

      const unpublishTarget = Effect.fn("LivePostChanges.unpublishTarget")(
        function* unpublishTarget(
          actor: Actor,
          postId: PostId,
          targetId: PostTargetId
        ) {
          yield* Effect.fromResult(authorize(actor, livePostChangePermission));

          return yield* transaction(
            Effect.gen(function* inTransaction() {
              // The post, then its target, as every use case locks them.
              const { post } = yield* lockInWorkspace(
                actor.workspaceId,
                postId
              ).pipe(Effect.provideContext(ports));

              const target = yield* posts.lockTarget(targetId);

              if (Option.isNone(target) || target.value.postId !== postId) {
                return yield* new PostNotFound({ postId });
              }

              const made = yield* unpublishLocked(actor, post, target.value);

              return yield* Result.match(made, {
                onFailure: (reason) =>
                  Effect.fail(new LivePostNotChangeable({ reason, targetId })),
                onSuccess: Effect.succeed,
              });
            })
          );
        }
      );

      // A social network's or a chat's edit: its text alone, checked as
      // scheduling checks that part. A rich text is no channel's there,
      // and Peal changes no option of a post live there.
      const socialEditOf = Effect.fn("LivePostChanges.socialEditOf")(
        function* socialEditOf(
          post: Post,
          target: PostTarget,
          channel: ChannelOnPlatform,
          edit: TextEditRequest
        ) {
          if (edit.body !== undefined) {
            yield* rejected([
              bodyViolation("bodyNotTaken", channel, edit.part),
            ]);
          }

          if (edit.options !== undefined) {
            yield* rejected([
              edit.part === 0
                ? { _tag: "optionsNotTaken", ...channel }
                : { _tag: "optionsNotTaken", ...channel, part: edit.part },
            ]);
          }

          const text = edit.text ?? "";

          yield* rejected(
            editViolationsOn({
              channel,
              content: post.content,
              options: target.options,
              part: edit.part,
              text,
            })
          );

          return Result.succeed<AskedEdit>({
            body: Option.none(),
            options: Option.none(),
            text,
          });
        }
      );

      // A website's edit: its text, or a rich text, and its options, each
      // kept when left out, checked as scheduling checks the post on the
      // channel once edited (`siteEditViolationsOn`), its files the
      // workspace's and ready (UnknownMedia).
      const siteEditOf = Effect.fn("LivePostChanges.siteEditOf")(
        function* siteEditOf(
          actor: Actor,
          post: Post,
          target: PostTarget,
          channel: ChannelOnPlatform,
          edit: TextEditRequest
        ) {
          const body = Option.fromUndefinedOr(
            edit.body === invalidBody ? undefined : edit.body
          );

          // A text that is nothing once made storable leaves the site an
          // empty post, as it would a social network's.
          if (
            Option.isNone(body) &&
            edit.text !== undefined &&
            edit.text.trim() === ""
          ) {
            yield* rejected([{ _tag: "empty", ...channel }]);
          }

          const text = Option.match(body, {
            onNone: () => edit.text ?? textOn(post.content, target.channelId),
            onSome: (rich) => textOfBody(rich, maxPostTextLength),
          });

          // Options sent again without a site status mean the target's.
          const options = Option.fromUndefinedOr(edit.options).pipe(
            Option.map((given) => withSiteStatusKept(given, target.options))
          );

          const chosen = Option.orElse(options, () => target.options);

          const shown = siteContentOn(
            withEditOn(post.content, 0, target.channelId, { body, text }),
            target.channelId
          );

          // A file the site took for the target already is not sent again:
          // only the others must still be the workspace's and ready.
          const held = new Set((yield* siteFiles.sent(target.id)).keys());

          const files = yield* mediaFor(
            actor,
            shown,
            Option.match(chosen, {
              onNone: () => [],
              onSome: (given) => [
                new ChannelOptions({
                  channelId: target.channelId,
                  options: given,
                }),
              ],
            }),
            held
          ).pipe(Effect.provideContext(ports));

          yield* rejected(
            siteEditViolationsOn({
              channel,
              content: shown,
              files,
              options: chosen,
              was: target.options,
            })
          );

          return Result.succeed<AskedEdit>({ body, options, text });
        }
      );

      // Why the locked target cannot be edited, or the change that will,
      // saved and started; a text its platform would refuse fails as
      // scheduling's does.
      const editLocked = Effect.fn("LivePostChanges.editLocked")(
        function* editLocked(
          actor: Actor,
          post: Post,
          target: PostTarget,
          edit: TextEditRequest
        ) {
          const latest = yield* store.latestOf(target.id);
          const platform = yield* platformOf(target);

          const part = editable(target, platform, edit.part, latest);

          if (Result.isFailure(part) || Option.isNone(platform)) {
            return Result.fail<LivePostRefusal>(
              Result.isFailure(part) ? part.failure : "channelUnavailable"
            );
          }

          const channel = {
            channelId: target.channelId,
            platform: platform.value,
          };

          if (edit.body === invalidBody) {
            yield* rejected([
              bodyViolation(
                "bodyInvalid",
                channel,
                edit.part,
                edit.bodyProblems
              ),
            ]);
          }

          const asked = isSitePlatform(platform.value)
            ? yield* siteEditOf(actor, post, target, channel, edit)
            : yield* socialEditOf(post, target, channel, edit);

          if (Result.isFailure(asked)) {
            return Result.fail<LivePostRefusal>(asked.failure);
          }

          const change = requestEdit({
            body: asked.success.body,
            channelId: target.channelId,
            id: yield* newId(LivePostChangeIdSchema).pipe(
              Effect.provideContext(ports)
            ),
            now: yield* DateTime.now,
            options: asked.success.options,
            part: part.success,
            postId: post.id,
            requestedBy:
              actor.subject._tag === "user"
                ? Option.some(actor.subject.userId)
                : Option.none(),
            requestedVia: Option.some(yield* origins.of(actor)),
            targetId: target.id,
            text: asked.success.text,
            workspaceId: post.workspaceId,
          });

          if (!(yield* store.insert(change))) {
            return Result.fail<LivePostRefusal>("changeInProgress");
          }

          yield* jobs.start(change.id);

          return Result.succeed(change);
        }
      );

      const editTarget = Effect.fn("LivePostChanges.editTarget")(
        function* editTarget(
          actor: Actor,
          postId: PostId,
          targetId: PostTargetId,
          asked: TextEditRequest
        ) {
          yield* Effect.fromResult(authorize(actor, livePostChangePermission));

          // An edit puts its words out at once: whoever's posts wait for an
          // approval asks an approver instead.
          if (yield* gate.holds(actor)) {
            return yield* new LivePostNotChangeable({
              reason: "approvalRequired",
              targetId,
            });
          }

          // Text Peal is given to keep: made storable before it is
          // checked, kept or sent.
          const edit: TextEditRequest =
            asked.text === undefined
              ? asked
              : {
                  ...asked,
                  text: storableText(asked.text, maxPostTextLength),
                };

          return yield* transaction(
            Effect.gen(function* inTransaction() {
              // The post, then its target, as every use case locks them.
              const { post } = yield* lockInWorkspace(
                actor.workspaceId,
                postId
              ).pipe(Effect.provideContext(ports));

              const target = yield* posts.lockTarget(targetId);

              if (Option.isNone(target) || target.value.postId !== postId) {
                return yield* new PostNotFound({ postId });
              }

              const made = yield* editLocked(actor, post, target.value, edit);

              return yield* Result.match(made, {
                onFailure: (reason) =>
                  Effect.fail(new LivePostNotChangeable({ reason, targetId })),
                onSuccess: Effect.succeed,
              });
            })
          );
        }
      );

      const unpublishPost = Effect.fn("LivePostChanges.unpublishPost")(
        function* unpublishPost(actor: Actor, postId: PostId) {
          yield* Effect.fromResult(authorize(actor, livePostChangePermission));

          return yield* transaction(
            Effect.gen(function* inTransaction() {
              const { post } = yield* lockInWorkspace(
                actor.workspaceId,
                postId
              ).pipe(Effect.provideContext(ports));

              const changes: LivePostChange[] = [];
              const refused: TargetRefusal[] = [];

              for (const target of yield* posts.lockTargets(postId)) {
                const made = yield* unpublishLocked(actor, post, target);

                if (Result.isSuccess(made)) {
                  changes.push(made.success);
                } else {
                  refused.push({ reason: made.failure, targetId: target.id });
                }
              }

              const answer: PostUnpublish = { changes, refused };

              return answer;
            })
          );
        }
      );

      const list = Effect.fn("LivePostChanges.list")(function* list(
        actor: Actor,
        postId: PostId
      ) {
        yield* Effect.fromResult(authorize(actor, "post:read"));

        yield* findInWorkspace(actor.workspaceId, postId).pipe(
          Effect.provideContext(ports)
        );

        return yield* store.ofPost(actor.workspaceId, postId);
      });

      const awaitEnd = Effect.fn("LivePostChanges.awaitEnd")(function* awaitEnd(
        change: LivePostChange,
        wait: Duration.Duration
      ) {
        const deadline = DateTime.addDuration(
          yield* DateTime.now,
          Duration.min(wait, maxOutcomeWait)
        );

        const untilEnded = Effect.gen(function* untilEnded() {
          let current = change;

          while (
            current.status === "pending" &&
            DateTime.isLessThan(yield* DateTime.now, deadline)
          ) {
            yield* Effect.sleep(readEvery);

            const read = yield* store.find(change.id);

            // Gone, as with its workspace: it stays as last read.
            if (Option.isSome(read)) {
              current = read.value;
            }
          }

          return current;
        });

        if (change.status !== "pending" || Duration.isZero(wait)) {
          return change;
        }

        const ended = yield* waiting
          .withPermitsIfAvailable(1)(untilEnded)
          .pipe(Effect.map(Option.getOrElse(() => change)));

        return ended;
      });

      return LivePostChanges.of({
        awaitEnd,
        editTarget,
        list,
        unpublishPost,
        unpublishTarget,
      });
    })
  );
}
