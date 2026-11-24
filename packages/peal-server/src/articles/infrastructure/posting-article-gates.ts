import { Effect, Layer } from "effect";

import { ArticleGates } from "#articles/application/article-gates.ts";
import { ApprovalGate } from "#publishing/application/approval-gate.ts";
import { PostAllowance } from "#publishing/application/post-allowance.ts";
import { withinPlan } from "#publishing/application/within-plan.ts";

/**
 * What articles go out under, as posts do: the approval policy
 * publishing's ApprovalGate holds posts by, and the plan's room for
 * channels and members, as publishing's PostAllowance counts it.
 */
export const PostingArticleGates = Layer.effect(
  ArticleGates,
  Effect.gen(function* PostingArticleGates() {
    const gate = yield* ApprovalGate;
    const allowance = yield* PostAllowance;

    return ArticleGates.of({
      holds: (actor) => gate.holds(actor),
      withinPlan: (workspaceId) =>
        withinPlan(workspaceId).pipe(
          Effect.provideService(PostAllowance, allowance)
        ),
    });
  })
);
