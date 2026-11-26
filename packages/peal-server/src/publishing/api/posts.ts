import { Array as Arr, Duration, Effect, Match, Option, Result } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import {
  Api,
  ChannelSetNotFound,
  CurrentMember,
  DuplicatePost,
  duplicateWindowHours,
  IdempotencyKeyReused,
  ImportUnreadable,
  PostExternalIdTaken,
  InvalidTimeRange,
  LastTargetLeft,
  LivePostNotChangeable,
  QueueHasNoRoom,
  QueueNotFound,
  ScheduleInPast,
  SignatureNotFound,
  TargetStatusConflict,
} from "peal-contract";
import type {
  BulkPostResult,
  ImportRowResult,
  PostRefusal,
} from "peal-contract";

import { LivePostChanges } from "#publishing/application/live-post-changes.ts";
import type { LivePostNotChangeable as LivePostNotChangeableError } from "#publishing/application/live-post-not-changeable.ts";
import { PostBatches } from "#publishing/application/post-batches.ts";
import { PostChecks } from "#publishing/application/post-checks.ts";
import { PostDrafts } from "#publishing/application/post-drafts.ts";
import { PostExternalIds } from "#publishing/application/post-external-ids.ts";
import { PostFollowUp } from "#publishing/application/post-follow-up.ts";
import type { Confirmation } from "#publishing/application/post-follow-up.ts";
import { PostOutcomes } from "#publishing/application/post-outcomes.ts";
import { PostPresets } from "#publishing/application/post-presets.ts";
import { PostQueries } from "#publishing/application/post-queries.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { PostSearch } from "#publishing/application/post-search.ts";
import { PostTags } from "#publishing/application/post-tags.ts";
import type { DuplicateContent } from "#publishing/domain/duplicate-content.ts";
import type { InvalidTargetTransition } from "#publishing/domain/invalid-target-transition.ts";
import { readImport } from "#publishing/domain/post-import.ts";
import { actorOf } from "#shared/api/actor.ts";
import { changesNothing } from "#shared/api/change-mark.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";

import {
  livePostChangeView,
  postUnpublishView,
} from "./live-post-change-view.ts";
import { keyAt, newPostOf, readPost, sendRead } from "./post-batch.ts";
import type { ReadPost } from "./post-batch.ts";
import { checkRequestFrom } from "./post-check-input.ts";
import { validationOf } from "./post-check-view.ts";
import {
  conflict,
  contentInvalid,
  externalIdTaken,
  notFound,
  setNotFound,
  signatureNotFound,
  unknownChannels,
  unknownMedia,
  unknownTags,
} from "./post-failures.ts";
import {
  channelIdsFrom,
  contentFrom,
  draftExternalIdFrom,
  draftTagsFrom,
  externalIdFrom,
  optionsFrom,
  presetsFrom,
  postIdFrom,
  queueIdOf,
  scheduleFrom,
  sendRequestFrom,
  tagIdsFrom,
  targetIdFrom,
} from "./post-input.ts";
import { refusalOfCheck, toldRefusal } from "./post-refusal.ts";
import { pageView, searchRequestFrom } from "./post-search.ts";
import { attemptView, freshPostViews, postView } from "./post-view.ts";

// How the use cases' failures answer. A database failure is a server error.

const inPast = () => Effect.fail(new ScheduleInPast());

const queueNotFound = () => Effect.fail(new QueueNotFound());

const noRoom = ({
  queueId,
  reason,
}: {
  readonly queueId: string;
  readonly reason: "full" | "noSlots";
}) => Effect.fail(new QueueHasNoRoom({ queueId, reason }));

const duplicate = ({ duplicates }: DuplicateContent) =>
  Effect.fail(
    new DuplicatePost({
      duplicates: duplicates.map(({ channelId, postId }) => ({
        channelId,
        postId,
      })),
    })
  );

const notChangeable = ({ reason }: LivePostNotChangeableError) =>
  Effect.fail(new LivePostNotChangeable({ reason }));

const targetConflict = ({ from }: InvalidTargetTransition) =>
  Effect.fail(new TargetStatusConflict({ status: from }));

const followUpFailures = {
  DatabaseError: Effect.die,
  InvalidPostTransition: conflict,
  InvalidTargetTransition: targetConflict,
  MissingPermission: forbidden,
  PostNotFound: notFound,
} as const;

export const PostsHandlers = HttpApiBuilder.group(
  Api,
  "posts",
  Effect.fn(function* postsHandlers(handlers) {
    const batches = yield* PostBatches;
    const checks = yield* PostChecks;
    const drafts = yield* PostDrafts;
    const externalIds = yield* PostExternalIds;
    const followUp = yield* PostFollowUp;
    const outcomes = yield* PostOutcomes;
    const queries = yield* PostQueries;
    const scheduling = yield* PostScheduling;
    const searching = yield* PostSearch;
    const tags = yield* PostTags;
    const presets = yield* PostPresets;
    const live = yield* LivePostChanges;
    const limitReached = yield* limitRefusal;
    const views = yield* freshPostViews;

    const toValidation = validationOf(limitReached);

    return handlers.handleAll({
      attempts: ({ params }) =>
        Effect.gen(function* attempts() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const made = yield* queries.attempts(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return made.map(attemptView);
        }),
      bulk: ({ headers, payload }) =>
        Effect.gen(function* bulk() {
          const actor = actorOf(yield* CurrentMember);

          const read = yield* Effect.all(
            payload.posts.map(({ idempotencyKey, ...post }, index) =>
              readPost(
                post,
                keyAt(idempotencyKey, headers["idempotency-key"], "bulk", index)
              )
            )
          );

          const answered = yield* sendRead(
            batches,
            limitReached,
            actor,
            read
          ).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
            }),
            Effect.flatMap((made) => views.results(made))
          );

          // A refused item reads as the error `send` would have answered.
          const items = yield* Effect.all(
            answered.map((outcome, index) =>
              toldRefusal<BulkPostResult>(
                Result.match(outcome, {
                  onFailure: (refusal) => ({ _tag: "refused", index, refusal }),
                  onSuccess: (sent) => ({
                    _tag: "created",
                    index,
                    post: postView(sent),
                    replayed: sent.replayed,
                  }),
                })
              )
            )
          );

          const created = items.filter(({ _tag }) => _tag === "created").length;

          return { created, items, refused: items.length - created };
        }),
      cancel: ({ params }) =>
        Effect.gen(function* cancel() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const cancelled = yield* scheduling.cancel(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidPostTransition: conflict,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return yield* views.one(cancelled);
        }),
      changes: ({ params }) =>
        Effect.gen(function* changes() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const listed = yield* live.list(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return { items: listed.map(livePostChangeView) };
        }),
      confirm: ({ params, payload }) =>
        Effect.gen(function* confirm() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const confirmation: Confirmation =
            payload._tag === "published"
              ? {
                  _tag: "published",
                  permalink: Option.fromNullOr(payload.permalink),
                }
              : { _tag: "notPublished" };

          const confirmed = yield* followUp
            .confirm(actor, postId, targetId, confirmation)
            .pipe(Effect.catchTags(followUpFailures));

          return yield* views.one(confirmed);
        }),
      duplicate: ({ params }) =>
        Effect.gen(function* duplicatePost() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const copy = yield* drafts.duplicate(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostContentRejected: contentInvalid,
              PostNotFound: notFound,
            })
          );

          return yield* views.one(copy);
        }),
      editTarget: ({ params, payload, query }) =>
        Effect.gen(function* editTarget() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const change = yield* live
            .editTarget(actor, postId, targetId, {
              part: payload.part ?? 0,
              text: payload.text,
            })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                LivePostNotChangeable: notChangeable,
                MissingPermission: forbidden,
                PostContentRejected: contentInvalid,
                PostNotFound: notFound,
              })
            );

          const ended = yield* live
            .awaitEnd(change, Duration.seconds(query.wait ?? 0))
            .pipe(Effect.orDie);

          return livePostChangeView(ended);
        }),
      enqueue: ({ params, payload }) =>
        Effect.gen(function* enqueue() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const queueId = yield* queueIdOf(payload.queueId);

          // The channels it names for a draft, if it names some.
          const named =
            payload.channelIds === undefined
              ? []
              : yield* channelIdsFrom(payload.channelIds);

          const channelIds = Arr.isReadonlyArrayNonEmpty(named)
            ? Option.some(named)
            : Option.none();

          const placed = yield* scheduling
            .enqueue(actor, postId, { channelIds, queueId })
            .pipe(
              Effect.catchTags({
                ChannelSetNotFound: setNotFound,
                DatabaseError: Effect.die,
                InvalidPostTransition: conflict,
                MissingPermission: forbidden,
                PlanLimitReached: limitReached,
                PostContentRejected: contentInvalid,
                PostNotFound: notFound,
                QueueHasNoRoom: noRoom,
                QueueNotFound: queueNotFound,
                ScheduleInPast: inPast,
                UnknownChannels: unknownChannels,
                UnknownMedia: unknownMedia,
              })
            );

          return yield* views.one(placed);
        }),
      get: ({ params }) =>
        Effect.gen(function* get() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const found = yield* queries.get(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return yield* views.one(found);
        }),
      import: ({ headers, payload }) =>
        Effect.gen(function* importPosts() {
          // A dry run reads and checks: it is no change to keep a record of.
          if (payload.dryRun === true) {
            yield* changesNothing;
          }

          const actor = actorOf(yield* CurrentMember);

          const rows = yield* Effect.fromResult(readImport(payload.csv)).pipe(
            Effect.mapError(
              ({ column, problem }) =>
                new ImportUnreadable({
                  column: Option.getOrNull(column),
                  problem,
                })
            )
          );

          // What the rows' channels cells list that is a channel set of the
          // workspace's rather than a channel.
          const sets = new Set(
            yield* presets
              .setsAmong(actor, [
                ...new Set(
                  rows.flatMap(({ post }) =>
                    Result.isSuccess(post) ? post.success.channels : []
                  )
                ),
              ])
              .pipe(Effect.catchTag("DatabaseError", Effect.die))
          );

          // Each row that could be read, as a post to send or the reason it
          // cannot be; none for a row that could not.
          const read = yield* Effect.all(
            rows.map(({ post, row }) =>
              Result.match(post, {
                onFailure: () => Effect.succeed(Option.none<ReadPost>()),
                onSuccess: (written) =>
                  readPost(
                    newPostOf(written, sets),
                    keyAt(
                      Option.getOrUndefined(written.idempotencyKey),
                      headers["idempotency-key"],
                      "import",
                      row
                    )
                  ).pipe(Effect.asSome),
              })
            )
          );

          const sendable = read.flatMap((post) =>
            Option.isSome(post) && Result.isSuccess(post.value)
              ? [post.value.success]
              : []
          );

          // The rows those are, in the same order.
          const sendableRows = read.flatMap((post, at) =>
            Option.isSome(post) && Result.isSuccess(post.value)
              ? [rows[at]?.row ?? at + 1]
              : []
          );

          const failures = {
            DatabaseError: Effect.die,
            MissingPermission: forbidden,
          } as const;

          // The whole file is checked before its first post is made.
          const checked = yield* batches
            .check(actor, sendable)
            .pipe(Effect.catchTags(failures));

          // A row its key already made has nothing to check, and one
          // whose key came with another row is refused as `send` would.
          const toRefusal = refusalOfCheck(limitReached);

          const refusals = yield* Effect.all(
            checked.map((found) =>
              Match.valueTags(found, {
                checked: ({ check }) => toRefusal(check),
                keyReused: () =>
                  Effect.succeed(
                    Option.some<PostRefusal>(new IdempotencyKeyReused())
                  ),
                made: () => Effect.succeed(Option.none<PostRefusal>()),
                // An earlier row of the file gives the same id: there is
                // no post to name yet, so the refusal names the row.
                idRepeats: ({ earlier }) =>
                  Effect.succeed(
                    Option.some<PostRefusal>(
                      new PostExternalIdTaken({
                        message: `Row ${String(sendableRows[earlier] ?? earlier + 1)} of the file gives the same external_id: nothing was made. An external id is unique among the workspace's posts that are not cancelled; give each row its own.`,
                        postId: null,
                      })
                    )
                  ),
                // What an earlier row of the file says: there is no post
                // to name yet, so the refusal names the row.
                repeats: ({ channelIds, earlier }) =>
                  Effect.succeed(
                    Option.some<PostRefusal>(
                      new DuplicatePost({
                        duplicates: [],
                        message: `Row ${String(sendableRows[earlier] ?? earlier + 1)} of the file sends the same content to ${channelIds.length === 1 ? "channel" : "channels"} ${channelIds.join(", ")}, less than ${String(duplicateWindowHours)} hours from this row's time: nothing was made. Change one of them, or give this row allow_duplicate true when it is meant.`,
                      })
                    )
                  ),
                unfilled: ({ missing }) =>
                  Effect.succeed(
                    Option.some<PostRefusal>(
                      missing._tag === "ChannelSetNotFound"
                        ? new ChannelSetNotFound()
                        : new SignatureNotFound()
                    )
                  ),
              })
            )
          );

          const allValid =
            sendable.length === rows.length && refusals.every(Option.isNone);

          if (payload.dryRun === true || !allValid) {
            let next = 0;

            const results = rows.map(
              ({ cellCount, post, row }, at): ImportRowResult => {
                const decoded = read[at] ?? Option.none();

                if (Result.isFailure(post) || Option.isNone(decoded)) {
                  return {
                    _tag: "unreadable",
                    ...Option.match(cellCount, {
                      onNone: () => ({}),
                      onSome: (cells) => ({ cells }),
                    }),
                    problems: Result.isFailure(post) ? [...post.failure] : [],
                    row,
                  };
                }

                if (Result.isFailure(decoded.value)) {
                  return {
                    _tag: "refused",
                    refusal: decoded.value.failure,
                    row,
                  };
                }

                const refusal = refusals[next] ?? Option.none();

                next += 1;

                return Option.match(refusal, {
                  onNone: () => ({ _tag: "valid", row }),
                  onSome: (found) => ({ _tag: "refused", refusal: found, row }),
                });
              }
            );

            return {
              created: 0,
              dryRun: payload.dryRun === true,
              rows: yield* Effect.all(
                results.map((result) => toldRefusal(result))
              ),
            };
          }

          const answered = yield* sendRead(
            batches,
            limitReached,
            actor,
            sendable.map((request) => Result.succeed(request))
          ).pipe(Effect.catchTags(failures), Effect.flatMap((made) => views.results(made)));

          const results = answered.map((outcome, at): ImportRowResult => {
            const row = rows[at]?.row ?? at + 1;

            return Result.match(outcome, {
              onFailure: (refusal) => ({ _tag: "refused", refusal, row }),
              onSuccess: (sent) => ({
                _tag: "created",
                post: postView(sent),
                replayed: sent.replayed,
                row,
              }),
            });
          });

          return {
            created: results.filter(({ _tag }) => _tag === "created").length,
            dryRun: false,
            rows: yield* Effect.all(
              results.map((result) => toldRefusal(result))
            ),
          };
        }),
      calendar: ({ query }) =>
        Effect.gen(function* list() {
          const actor = actorOf(yield* CurrentMember);

          const listed = yield* queries.listScheduled(actor, query).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidTimeRange: () => Effect.fail(new InvalidTimeRange()),
              MissingPermission: forbidden,
            })
          );

          return listed.map(postView);
        }),
      outcome: ({ params, query }) =>
        Effect.gen(function* outcome() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const awaited = yield* outcomes
            .await(actor, postId, Duration.seconds(query.wait ?? 0))
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
                PostNotFound: notFound,
              })
            );

          return yield* views.one(awaited);
        }),
      removeTarget: ({ params }) =>
        Effect.gen(function* removeTarget() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const removed = yield* scheduling
            .dropTarget(actor, postId, targetId)
            .pipe(
              Effect.catchTags({
                ...followUpFailures,
                LastTargetLeft: () => Effect.fail(new LastTargetLeft()),
              })
            );

          return yield* views.one(removed);
        }),
      leaveOutRest: ({ params }) =>
        Effect.gen(function* leaveOutRest() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const settled = yield* followUp
            .leaveOutRest(actor, postId, targetId)
            .pipe(Effect.catchTags(followUpFailures));

          return yield* views.one(settled);
        }),
      repost: ({ params }) =>
        Effect.gen(function* repost() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const reposted = yield* followUp
            .repost(actor, postId, targetId)
            .pipe(Effect.catchTags(followUpFailures));

          return yield* views.one(reposted);
        }),
      reschedule: ({ params, payload }) =>
        Effect.gen(function* reschedule() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const at = yield* scheduleFrom(payload.at, payload.timeZone);

          const moved = yield* scheduling.reschedule(actor, postId, at).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidPostTransition: conflict,
              MissingPermission: forbidden,
              PlanLimitReached: limitReached,
              PostContentRejected: contentInvalid,
              PostNotFound: notFound,
              ScheduleInPast: inPast,
              UnknownChannels: unknownChannels,
              UnknownMedia: unknownMedia,
            })
          );

          return yield* views.one(moved);
        }),
      schedule: ({ params, payload }) =>
        Effect.gen(function* schedule() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const channelIds = yield* channelIdsFrom(payload.channelIds);
          const at = yield* scheduleFrom(payload.at, payload.timeZone);

          const scheduled = yield* scheduling
            .scheduleDraft(actor, postId, { channelIds, schedule: at })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                InvalidPostTransition: conflict,
                MissingPermission: forbidden,
                PlanLimitReached: limitReached,
                PostContentRejected: contentInvalid,
                PostNotFound: notFound,
                ScheduleInPast: inPast,
                UnknownChannels: unknownChannels,
                UnknownMedia: unknownMedia,
              })
            );

          return yield* views.one(scheduled);
        }),
      list: ({ query }) =>
        Effect.gen(function* search() {
          const actor = actorOf(yield* CurrentMember);
          const { removed, ...filters } = query;

          const request = searchRequestFrom(
            removed === undefined
              ? filters
              : { ...filters, removed: removed === "true" }
          );

          const page = yield* searching.search(actor, request).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidCursor: () => Effect.fail(new HttpApiError.BadRequest()),
              InvalidTimeRange: () => Effect.fail(new InvalidTimeRange()),
              MissingPermission: forbidden,
            })
          );

          return pageView(page);
        }),
      create: ({ headers, payload, query }) =>
        Effect.gen(function* send() {
          const actor = actorOf(yield* CurrentMember);

          const request = yield* sendRequestFrom(
            payload,
            headers["idempotency-key"]
          );

          const sent = yield* scheduling.send(actor, request).pipe(
            Effect.catchTags({
              ChannelSetNotFound: setNotFound,
              DatabaseError: Effect.die,
              DuplicateContent: duplicate,
              IdempotencyKeyReused: () =>
                Effect.fail(new IdempotencyKeyReused()),
              MissingPermission: forbidden,
              PlanLimitReached: limitReached,
              PostContentRejected: contentInvalid,
              PostExternalIdTaken: externalIdTaken,
              PostNotFound: notFound,
              QueueHasNoRoom: noRoom,
              QueueNotFound: queueNotFound,
              ScheduleInPast: inPast,
              SignatureNotFound: signatureNotFound,
              UnknownChannels: unknownChannels,
              UnknownMedia: unknownMedia,
            })
          );

          // Asked to wait, it answers once the post went out, or with what
          // it has when the time runs out; never an error, now that the
          // post is made.
          const awaited = yield* outcomes
            .afterSending(actor, sent, Duration.seconds(query.wait ?? 0))
            .pipe(Effect.orDie);

          return yield* views.one(awaited);
        }),
      setExternalId: ({ params, payload }) =>
        Effect.gen(function* setExternalId() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const externalId =
            payload.externalId === null
              ? Option.none()
              : Option.some(yield* externalIdFrom(payload.externalId));

          const given = yield* externalIds.set(actor, postId, externalId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostExternalIdTaken: externalIdTaken,
              PostNotFound: notFound,
            })
          );

          return yield* views.one(given);
        }),
      setTags: ({ params, payload }) =>
        Effect.gen(function* tag() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const tagIds = yield* tagIdsFrom(payload.tagIds);

          const tagged = yield* tags.assign(actor, postId, tagIds).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostNotFound: notFound,
              UnknownTags: unknownTags,
            })
          );

          return yield* views.one(tagged);
        }),
      unpublish: ({ params }) =>
        Effect.gen(function* unpublish() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const made = yield* live.unpublishPost(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return postUnpublishView(made);
        }),
      unpublishTarget: ({ params, query }) =>
        Effect.gen(function* unpublishTarget() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const targetId = yield* targetIdFrom(params.targetId);

          const change = yield* live
            .unpublishTarget(actor, postId, targetId)
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                LivePostNotChangeable: notChangeable,
                MissingPermission: forbidden,
                PostNotFound: notFound,
              })
            );

          const ended = yield* live
            .awaitEnd(change, Duration.seconds(query.wait ?? 0))
            .pipe(Effect.orDie);

          return livePostChangeView(ended);
        }),
      unschedule: ({ params }) =>
        Effect.gen(function* unschedule() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          const draft = yield* scheduling.unschedule(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidPostTransition: conflict,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );

          return yield* views.one(draft);
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* update() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);
          const channelIds = yield* channelIdsFrom(payload.channelIds);
          const content = yield* contentFrom(payload.content);
          const options = yield* optionsFrom(payload.options ?? []);
          const filed = yield* draftTagsFrom(payload.tagIds);
          const own = yield* draftExternalIdFrom(payload.externalId);
          const asked = yield* presetsFrom(payload);

          const updated = yield* drafts
            .update(actor, postId, {
              channelIds,
              content,
              options,
              presets: asked,
              shortenLinks: payload.shortenLinks,
              ...filed,
              ...own,
            })
            .pipe(
              Effect.catchTags({
                ChannelSetNotFound: setNotFound,
                DatabaseError: Effect.die,
                InvalidPostTransition: conflict,
                MissingPermission: forbidden,
                PostContentRejected: contentInvalid,
                PostExternalIdTaken: externalIdTaken,
                PostNotFound: notFound,
                SignatureNotFound: signatureNotFound,
                UnknownChannels: unknownChannels,
                UnknownMedia: unknownMedia,
                UnknownTags: unknownTags,
              })
            );

          return yield* views.one(updated);
        }),
      validate: ({ payload }) =>
        Effect.gen(function* validate() {
          const actor = actorOf(yield* CurrentMember);
          const read = yield* checkRequestFrom(payload);

          const check = yield* checks.check(actor, read.request).pipe(
            Effect.catchTags({
              ChannelSetNotFound: setNotFound,
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
              QueueNotFound: queueNotFound,
              SignatureNotFound: signatureNotFound,
            })
          );

          return yield* toValidation(check, read);
        }),
    });
  })
);
