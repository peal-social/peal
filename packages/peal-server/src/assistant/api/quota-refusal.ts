import { Effect, Option } from "effect";
import type { DateTime } from "effect";
import { AssistantQuotaExceeded } from "peal-contract";

import { UpgradePaths } from "#shared/application/upgrade-paths.ts";
import type { Actor } from "#shared/domain/access.ts";

/** What a workspace's day of assistant requests held, and what was asked. */
export interface QuotaReached {
  readonly dailyLimit: number;
  readonly needed: number;
  readonly resetsAt: DateTime.Utc;
}

/** Answers the daily quota's refusal as the contract tells clients. */
export type QuotaRefusal = (
  actor: Actor,
  reached: QuotaReached
) => Effect.Effect<never, AssistantQuotaExceeded>;

/**
 * The quota's refusal, with the smallest plan whose day holds `needed`
 * requests, and where to order it. The text's handlers and the images'
 * answer with it alike. Built with the group, as its use cases are.
 */
export const quotaRefusal: Effect.Effect<QuotaRefusal, never, UpgradePaths> =
  UpgradePaths.use((paths) =>
    Effect.succeed(
      (actor: Actor, { dailyLimit, needed, resetsAt }: QuotaReached) =>
        paths.from(actor.workspaceId, "assistantRequests", needed).pipe(
          Effect.flatMap((path) =>
            Effect.fail(
              new AssistantQuotaExceeded({
                // A server that does not bill has no billing page to send
                // anyone to.
                billingUrl: Option.isSome(path.plan) ? path.billingUrl : null,
                dailyLimit,
                plan: Option.getOrNull(path.plan),
                planWithRoom: Option.getOrNull(path.planWithRoom),
                resetsAt,
              })
            )
          )
        )
    )
  );
