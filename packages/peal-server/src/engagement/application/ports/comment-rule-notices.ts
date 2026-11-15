import { Context, Effect, Layer } from "effect";
import type { Option } from "effect";

import type { CommentRuleEndReason } from "#engagement/domain/comment-rule-end-reason.ts";
import type { CommentRuleId } from "#engagement/domain/comment-rule-id.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/** A comment rule that ended, as its notice needs it. */
export interface StoppedCommentRule {
  readonly id: CommentRuleId;
  readonly startedBy: Option.Option<UserId>;
  readonly workspaceId: WorkspaceId;
}

/**
 * Tells those who expect a comment rule to answer that it ended by itself
 * (`starterGone`, `channelGone`), in the transaction that ends it, once a
 * rule: a member's own stop is not told.
 */
export class CommentRuleNotices extends Context.Service<
  CommentRuleNotices,
  {
    readonly stopped: (
      rule: StoppedCommentRule,
      reason: Exclude<CommentRuleEndReason, "stopped">
    ) => Effect.Effect<void, DatabaseError>;
  }
>()("peal-server/engagement/application/CommentRuleNotices") {
  /** For tests: nobody hears. */
  static readonly none = Layer.succeed(
    CommentRuleNotices,
    CommentRuleNotices.of({ stopped: () => Effect.void })
  );
}
