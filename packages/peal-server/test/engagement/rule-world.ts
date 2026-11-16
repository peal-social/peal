import { DateTime, Effect, Layer, Option, Ref } from "effect";
import { MessageStorage, ShardingConfig } from "effect/cluster";
import { SqlClient } from "effect/sql";

import { CommentRules } from "#engagement/application/comment-rules.ts";
import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import { EngagementReplies } from "#engagement/application/engagement-replies.ts";
import { CommentRuleNotices } from "#engagement/application/ports/comment-rule-notices.ts";
import type { CommentRuleStore } from "#engagement/application/ports/comment-rule-store.ts";
import { EngagementChannels } from "#engagement/application/ports/engagement-channels.ts";
import type { EngagedChannel } from "#engagement/application/ports/engagement-channels.ts";
import { EngagementOutcomes } from "#engagement/application/ports/engagement-outcomes.ts";
import { EngagementStore } from "#engagement/application/ports/engagement-store.ts";
import { FollowedPosts } from "#engagement/application/ports/followed-posts.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { PrivateReplyJobs } from "#engagement/application/ports/private-reply-jobs.ts";
import { ReplyJobs } from "#engagement/application/ports/reply-jobs.ts";
import { RuleStarters } from "#engagement/application/ports/rule-starters.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { CommentRuleIdSchema } from "#engagement/domain/comment-rule-id.ts";
import { receiveComment } from "#engagement/domain/comment.ts";
import { followBox } from "#engagement/domain/message-box.ts";
import { ThreadIdSchema } from "#engagement/domain/thread-id.ts";
import { followPost } from "#engagement/domain/thread.ts";
import { DrizzleCommentRuleStore } from "#engagement/infrastructure/drizzle-comment-rule-store.ts";
import { DrizzleEngagementRecords } from "#engagement/infrastructure/drizzle-engagement-records.ts";
import { DrizzleEngagementStore } from "#engagement/infrastructure/drizzle-engagement-store.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { PublishingReplyLimits } from "#engagement/infrastructure/publishing-reply-limits.ts";
import { UnreadComments } from "#publishing/container.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import { newId } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
} from "#shared/domain/ids.ts";
import type { ChannelId, PostId, WorkspaceId } from "#shared/domain/ids.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
} from "#shared/domain/inbox-message-platform.ts";
import {
  facebookCommentScopes,
  instagramLoginCommentScope,
} from "#shared/domain/inbox-platform.ts";
import type { Platform } from "#shared/domain/platform.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import { DatabaseTest } from "#test/channels/support.ts";
import { reading } from "#test/engagement/support.ts";
import { actorIn } from "#test/publishing/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The comment rules' world on Postgres, with the inbox's own replies and
// private replies: fakes for the channels, the followed posts, the
// starters, the notices and the jobs, as a test sets them, and helpers
// that write what a test needs. Rows are written under a workspace of each
// test's own, on the real clock (the pool's timers would replay a virtual
// one's years), and deleted after.

export const utc = (iso: string) => DateTime.makeUnsafe(iso);

// The channels' platforms, as a test sets them.
export const platformsOf = Ref.makeUnsafe<ReadonlyMap<ChannelId, Platform>>(
  new Map()
);

// The channels each post is for, as publishing would say, scheduled or out.
export const postChannels = Ref.makeUnsafe<
  ReadonlyMap<PostId, readonly ChannelId[]>
>(new Map());

export const FakeFollowedPosts = Layer.succeed(
  FollowedPosts,
  FollowedPosts.of({
    channelsOf: (_workspaceId, postId) =>
      Ref.get(postChannels).pipe(
        Effect.map((known) => known.get(postId) ?? [])
      ),
    from: () => Effect.succeed([]),
  })
);

// The rules told stopped, with why.
export const stoppedRules = Ref.makeUnsafe<
  readonly (readonly [string, string])[]
>([]);

export const RecordedRuleNotices = Layer.succeed(
  CommentRuleNotices,
  CommentRuleNotices.of({
    stopped: (rule, reason) =>
      Ref.update(stoppedRules, (told) => [...told, [rule.id, reason] as const]),
  })
);

// The workspaces whose rules' starters are gone, as a test says.
export const startersGone = Ref.makeUnsafe<ReadonlySet<WorkspaceId>>(new Set());

// What happens, once, when a run next asks for a rule's starter: a
// member's change made while the run goes.
export const meanwhile = Ref.makeUnsafe<Effect.Effect<void>>(Effect.void);

// The replies' jobs started: a reply is journalled, never sent here.
export const started = Ref.makeUnsafe<readonly string[]>([]);

// A channel of each platform as a member connects it, with every
// permission its comments and messages take: a Page, an Instagram account
// through Instagram Login, a Mastodon account.
export const connected = (platform: Platform): EngagedChannel => {
  if (platform === "facebook") {
    return {
      accountId: "page-account",
      connection: Option.none(),
      platform,
      scopes: [
        "pages_show_list",
        facebookCommentScopes.read,
        facebookCommentScopes.manage,
        ...facebookMessageScopes,
      ],
    };
  }

  if (platform === "instagram") {
    return {
      accountId: "instagram-account",
      connection: Option.some("instagramLogin"),
      platform,
      scopes: [instagramLoginCommentScope, instagramLoginMessageScope],
    };
  }

  return {
    connection: Option.none(),
    platform,
    scopes: ["read", "write", "read:statuses", "write:statuses", "profile"],
  };
};

export const FakeChannels = Layer.succeed(
  EngagementChannels,
  EngagementChannels.of({
    belongs: (channelId) =>
      Ref.get(platformsOf).pipe(Effect.map((known) => known.has(channelId))),
    describe: (channelId) =>
      Ref.get(platformsOf).pipe(
        Effect.map((known) => connected(known.get(channelId) ?? "mastodon"))
      ),
  })
);

// The private replies' jobs started: journalled, never sent here.
export const privateStarted = Ref.makeUnsafe<readonly string[]>([]);

// What the starter of every rule may do now, as a test sets it.
export const starterPermissions = Ref.makeUnsafe(permissionsFor("editor"));

export const rulesTestWith = <E, R>(
  store: Layer.Layer<CommentRuleStore, E, R>,
  meters: Layer.Layer<MeteredUsage> = MeteredUsage.layerUnmetered
) =>
  CommentRules.layer.pipe(
    Layer.provideMerge(
      Layer.merge(EngagementReplies.layer, EngagementPrivateReplies.layer)
    ),
    Layer.provideMerge(
      DrizzleEngagementRecords.pipe(Layer.provide(RecordedRuleNotices))
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        store,
        DrizzleEngagementStore,
        DrizzleMessageStore,
        DrizzlePrivateReplyStore,
        FakeChannels,
        FakeFollowedPosts,
        PublishingReplyLimits,
        Layer.succeed(
          ReplyJobs,
          ReplyJobs.of({
            cancel: () => Effect.void,
            start: (replyId) => Ref.update(started, (ids) => [...ids, replyId]),
          })
        ),
        Layer.succeed(
          PrivateReplyJobs,
          PrivateReplyJobs.of({
            cancel: () => Effect.void,
            start: (privateReplyId) =>
              Ref.update(privateStarted, (ids) => [...ids, privateReplyId]),
          })
        ),
        Layer.succeed(
          CurrentInboxPlatforms,
          new Set(["facebook", "instagram"])
        ),
        Layer.succeed(CurrentInboxMessages, new Set(["facebook", "instagram"])),
        Layer.succeed(
          EngagementOutcomes,
          EngagementOutcomes.of({
            received: () => Effect.void,
            replied: () => Effect.void,
          })
        ),
        Layer.succeed(
          RuleStarters,
          RuleStarters.of({
            of: (rule) =>
              Ref.getAndSet(meanwhile, Effect.void).pipe(
                Effect.flatten,
                Effect.andThen(
                  Effect.all([
                    Ref.get(startersGone),
                    Ref.get(starterPermissions),
                  ])
                ),
                Effect.map(([gone, permissions]) =>
                  gone.has(rule.workspaceId)
                    ? ({ _tag: "gone" } as const)
                    : ({
                        _tag: "acting",
                        actor: actorIn(rule.workspaceId, permissions),
                      } as const)
                )
              ),
          })
        ),
        UnreadComments,
        RecordedRuleNotices,
        meters
      )
    ),
    Layer.provideMerge(Layer.mergeAll(IdsLive, TransactionRunnerLive)),
    // The transaction runner's, though nothing here starts a job of the
    // cluster's: replies' jobs are a fake's.
    Layer.provideMerge(
      MessageStorage.layerMemory.pipe(Layer.provide(ShardingConfig.layer()))
    ),
    Layer.provideMerge(DatabaseTest)
  );

export const RulesTest = rulesTestWith(DrizzleCommentRuleStore);

export const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.comment_rules WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.threads WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

export const publishedAt = "2047-03-02T10:00:00.000Z";

// A post that went out on a channel of `platform`, followed by the inbox.
export const threadOn = Effect.fn("threadOn")(function* threadOn(
  workspaceId: WorkspaceId,
  platform: Platform,
  onPost?: PostId
) {
  const channelId = yield* newId(ChannelIdSchema);

  yield* Ref.update(
    platformsOf,
    (known) => new Map([...known, [channelId, platform]])
  );

  const thread = followPost(yield* newId(ThreadIdSchema), {
    authorId: Option.none(),
    channelId,
    permalink: Option.none(),
    platformPostId: PlatformPostIdSchema.make("1001"),
    postId: onPost ?? (yield* newId(PostIdSchema)),
    publishedAt: utc(publishedAt),
    targetId: yield* newId(PostTargetIdSchema),
    workspaceId,
  });

  yield* EngagementStore.use((store) => store.follow([thread]));

  return thread;
});

// Comments received now, as the collection keeps them, written now or at
// `writtenAt`.
export const received = Effect.fn("received")(function* received(
  thread: Effect.Success<ReturnType<typeof threadOn>>,
  given: readonly { readonly author: number; readonly text: string }[],
  writtenAt?: DateTime.Utc
) {
  const now = yield* DateTime.now;
  const written = writtenAt ?? now;

  const comments = yield* Effect.forEach(
    (one: { readonly author: number; readonly text: string }) =>
      newId(CommentIdSchema).pipe(
        Effect.map((id) =>
          receiveComment(
            id,
            thread,
            reading(one.author, {
              platformCommentId: `${String(one.author)}-${one.text}`,
              text: one.text,
              writtenAt: written,
            }),
            now
          )
        )
      )
  )(given);

  yield* EngagementStore.use((store) => store.saveComments(comments));

  return comments;
});

// The channel's messages turned on in the workspace, as a member does.
export const messagesOn = (workspaceId: WorkspaceId, channelId: ChannelId) =>
  Effect.gen(function* switching() {
    const now = yield* DateTime.now;

    yield* MessageStore.use((store) =>
      store.switchOn(
        { channelId, enabledAt: now, enabledBy: Option.none(), workspaceId },
        followBox({ channelId, workspaceId }, now)
      )
    );
  });

// Why a reply ended as it did, as its job would say.
const reasonOf = {
  failed: "refused",
  sent: null,
  unconfirmed: "noResponse",
} as const;

// The workspace's public replies as their jobs ended them.
export const publicRepliesEnd = (
  workspaceId: WorkspaceId,
  status: "sent" | "failed" | "unconfirmed",
  commentId?: string
) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      UPDATE engagement.replies
      SET status = ${status}, settled_at = now(),
        platform_comment_id = ${status === "sent" ? "public-reply-1" : null},
        reason = ${reasonOf[status]}
      WHERE workspace_id = ${workspaceId} AND status = 'sending'
        AND (${commentId ?? null}::uuid IS NULL OR comment_id = ${commentId ?? null}::uuid)
    `
  ).pipe(Effect.asVoid, Effect.orDie);

// The private replies journalled in the workspace, by comment.
export const privateRepliesIn = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use(
    (sql) => sql<{
      readonly commentId: string;
      readonly id: string;
      readonly ruleId: string | null;
      readonly text: string;
    }>`
      SELECT comment_id AS "commentId", id, rule_id AS "ruleId", text
      FROM engagement.private_replies WHERE workspace_id = ${workspaceId}
      ORDER BY created_at
    `
  ).pipe(Effect.orDie);

// What a rule's view says of the private reply of each comment it answered.
export const privateOutcomes = (workspaceId: WorkspaceId, ruleId: string) =>
  CommentRules.use((rules) =>
    rules.get(actorIn(workspaceId), CommentRuleIdSchema.make(ruleId))
  ).pipe(
    Effect.map(
      (listed) =>
        new Map(
          listed.matches.map(({ commentId, outcome }) => [
            commentId,
            outcome._tag === "replied"
              ? Option.match(outcome.private, {
                  onNone: () => "none",
                  onSome: (made) =>
                    made._tag === "privateReply" ? "made" : made.code,
                })
              : outcome._tag,
          ])
        )
    )
  );

export const privateText =
  "Here is the price list, just for you. (Automatic message)";

// A rule with a private reply on an Instagram channel whose messages are on.
export const instagramRule = Effect.fn("instagramRule")(function* instagramRule(
  workspaceId: WorkspaceId
) {
  const thread = yield* threadOn(workspaceId, "instagram");

  yield* messagesOn(workspaceId, thread.channelId);

  const rule = yield* CommentRules.use((rules) =>
    rules.start(actorIn(workspaceId), {
      keywords: ["price"],
      privateReply: privateText,
      reply: "The price list is in your messages.",
      scope: { _tag: "channel", channelId: thread.channelId },
    })
  );

  yield* Effect.sleep("5 millis");

  return { rule, thread };
});
