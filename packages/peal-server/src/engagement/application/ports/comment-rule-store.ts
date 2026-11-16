import { Context } from "effect";
import type { DateTime, Effect, Option } from "effect";

import type { CommentId } from "#engagement/domain/comment-id.ts";
import type { CommentRuleId } from "#engagement/domain/comment-rule-id.ts";
import type {
  CommentRule,
  CommentRuleStatus,
} from "#engagement/domain/comment-rule.ts";
import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import type { ReplyId } from "#engagement/domain/reply-id.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelId, PostId, WorkspaceId } from "#shared/domain/ids.ts";

/** A page of a workspace's rules, oldest first, after a rule. */
export interface CommentRulePage {
  readonly after: Option.Option<CommentRuleId>;
  readonly limit: number;
  readonly status: Option.Option<CommentRuleStatus["_tag"]>;
}

/** A comment a rule may answer: received since it started, unanswered. */
export interface Candidate {
  readonly authorPlatformId: Option.Option<string>;
  readonly channelId: ChannelId;
  readonly commentId: CommentId;
  readonly text: string;
}

/**
 * What came of a rule's private reply to a comment it answered: the
 * private reply made (`privateReplyId`), or why none was (`code`). Neither
 * when the rule had none to send.
 */
export type PrivateOutcome =
  | { readonly _tag: "privateReply"; readonly privateReplyId: PrivateReplyId }
  | { readonly _tag: "privateCode"; readonly code: string };

/** What came of a comment a rule looked at. */
export type MatchOutcome =
  | { readonly _tag: "noMatch" }
  | { readonly _tag: "samePerson" }
  | {
      readonly _tag: "replied";
      readonly replyId: ReplyId;
      readonly private: Option.Option<PrivateOutcome>;
    }
  | { readonly _tag: "refused"; readonly code: string };

/** A comment a rule looked at, as a rule's view lists it. */
export interface RuleMatch {
  readonly commentId: CommentId;
  readonly lookedAt: DateTime.Utc;
  readonly outcome: MatchOutcome | { readonly _tag: "claimed" };
  /** Where the private reply it made stands, if it made one. */
  readonly privateStatus: Option.Option<PrivateReply["status"]["_tag"]>;
}

/**
 * A comment a rule answered in public whose private reply waits for the
 * public one to be out.
 */
export interface WaitingPrivateReply {
  readonly channelId: ChannelId;
  readonly commentId: CommentId;
  /** When the rule answered the comment: the comment was written before. */
  readonly lookedAt: DateTime.Utc;
  readonly replyId: ReplyId;
}

/** The workspaces' comment rules and what they looked at. */
export class CommentRuleStore extends Context.Service<
  CommentRuleStore,
  {
    /** Holds back, until the transaction ends, others claiming the workspace's rules. */
    readonly claim: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError>;
    readonly insert: (rule: CommentRule) => Effect.Effect<void, DatabaseError>;
    /**
     * Writes what changes of a rule: its keywords, replies, status,
     * starter.
     */
    readonly update: (rule: CommentRule) => Effect.Effect<void, DatabaseError>;
    readonly rule: (
      workspaceId: WorkspaceId,
      ruleId: CommentRuleId
    ) => Effect.Effect<Option.Option<CommentRule>, DatabaseError>;
    readonly lock: (
      workspaceId: WorkspaceId,
      ruleId: CommentRuleId
    ) => Effect.Effect<Option.Option<CommentRule>, DatabaseError>;
    readonly countOpen: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<number, DatabaseError>;
    readonly list: (
      workspaceId: WorkspaceId,
      page: CommentRulePage
    ) => Effect.Effect<readonly CommentRule[], DatabaseError>;
    /** Active rules of every workspace, after `after` by id: `limit` at most. */
    readonly active: (
      after: Option.Option<CommentRuleId>,
      limit: number
    ) => Effect.Effect<readonly CommentRule[], DatabaseError>;
    /** The channels a post has threads of in the inbox. */
    readonly channelsOfPost: (
      workspaceId: WorkspaceId,
      postId: PostId
    ) => Effect.Effect<readonly ChannelId[], DatabaseError>;
    /**
     * Comments the rule has not looked at, or claimed before
     * `claimedBefore` and never settled, on the channels `channelIds`
     * under the posts it answers on, received from `answersFrom` and still
     * waiting for an answer, oldest first: `limit` at most.
     */
    readonly candidates: (
      rule: CommentRule,
      channelIds: readonly ChannelId[],
      claimedBefore: DateTime.Utc,
      limit: number
    ) => Effect.Effect<readonly Candidate[], DatabaseError>;
    /**
     * Holds back, until the transaction it runs in ends, any other that
     * claims the rule's day or the channel's: counting the replies made
     * today, then claiming a comment to answer, takes turns, so
     * overlapping runs never pass a cap. The rule's first, then the
     * channel's, always in that order.
     */
    readonly claimReplyDay: (
      ruleId: CommentRuleId,
      channelId: ChannelId
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * How many replies every rule made on the channel since `since`, or
     * is making: a comment claimed since then counts, its reply on its
     * way.
     */
    readonly repliedOnChannelSince: (
      channelId: ChannelId,
      since: DateTime.Utc
    ) => Effect.Effect<number, DatabaseError>;
    /**
     * Marks the comment looked at by the rule (`claimed`), or takes again
     * a claim older than `claimedBefore` that never settled: false when
     * another run holds it, or settled it.
     */
    readonly claimMatch: (
      ruleId: CommentRuleId,
      commentId: CommentId,
      now: DateTime.Utc,
      claimedBefore: DateTime.Utc
    ) => Effect.Effect<boolean, DatabaseError>;
    readonly settleMatch: (
      ruleId: CommentRuleId,
      commentId: CommentId,
      outcome: MatchOutcome
    ) => Effect.Effect<void, DatabaseError>;
    /** Forgets a claim whose reply was put off, so a later run answers it. */
    readonly releaseMatch: (
      ruleId: CommentRuleId,
      commentId: CommentId
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * How many replies the rule made since `since`, or is making: a
     * comment claimed since then counts, its reply on its way.
     */
    readonly repliedSince: (
      ruleId: CommentRuleId,
      since: DateTime.Utc
    ) => Effect.Effect<number, DatabaseError>;
    /**
     * Whether the rule answered the author already, or is answering them,
     * under another comment than `commentId`.
     */
    readonly answeredAuthor: (
      ruleId: CommentRuleId,
      authorPlatformId: string,
      commentId: CommentId
    ) => Effect.Effect<boolean, DatabaseError>;
    /**
     * The comments the rule answered whose private reply waits for the
     * public one (its code `waiting`), oldest first: `limit` at most.
     */
    readonly waitingPrivate: (
      ruleId: CommentRuleId,
      limit: number
    ) => Effect.Effect<readonly WaitingPrivateReply[], DatabaseError>;
    /**
     * Writes what came of a waiting private reply: false when it no longer
     * waits (another run settled it, or the rule stopped).
     */
    readonly settlePrivate: (
      ruleId: CommentRuleId,
      commentId: CommentId,
      outcome: PrivateOutcome
    ) => Effect.Effect<boolean, DatabaseError>;
    /**
     * Settles every private reply of the rule still waiting as `stopped`:
     * a rule paused, ended or without its private text sends none after.
     */
    readonly stopWaiting: (
      ruleId: CommentRuleId
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * Settles `stopped` the matches whose private replies were held back
     * before they set out (`privateReplyIds`).
     */
    readonly unmakePrivate: (
      ruleId: CommentRuleId,
      privateReplyIds: readonly PrivateReplyId[]
    ) => Effect.Effect<void, DatabaseError>;
    /** What the rule looked at, newest first, but what matched nothing. */
    readonly matchesOf: (
      ruleId: CommentRuleId,
      limit: number
    ) => Effect.Effect<readonly RuleMatch[], DatabaseError>;
  }
>()("peal-server/engagement/application/CommentRuleStore") {}
