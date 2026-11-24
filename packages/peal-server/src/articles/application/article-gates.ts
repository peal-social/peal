import { Context, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/**
 * What an article goes out under, as posts do: the workspace's approval
 * policy, which articles have no approval of yet, so what it holds is
 * refused, and the plan's room for channels and members.
 */
export class ArticleGates extends Context.Service<
  ArticleGates,
  {
    /** Whether the workspace's approval policy holds what the actor sends. */
    readonly holds: (actor: Actor) => Effect.Effect<boolean, DatabaseError>;
    /** Fails while the workspace holds more channels or members than its plan allows. */
    readonly withinPlan: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError | PlanLimitReached>;
  }
>()("peal-server/articles/application/ArticleGates") {
  /** For tests: nothing is held, and every workspace is within its plan. */
  static readonly open = Layer.succeed(
    ArticleGates,
    ArticleGates.of({
      holds: () => Effect.succeed(false),
      withinPlan: () => Effect.void,
    })
  );
}
