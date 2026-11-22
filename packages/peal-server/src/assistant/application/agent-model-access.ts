import { Context, DateTime, Effect, Layer, Option } from "effect";
import type { Scope } from "effect";

import { AssistantQuotaExceeded } from "#assistant/application/assistant-quota-exceeded.ts";
import { AssistantUnavailable } from "#assistant/application/assistant-unavailable.ts";
import { OwnTextBusy } from "#assistant/application/own-text-busy.ts";
import { OwnTextExhausted } from "#assistant/application/own-text-exhausted.ts";
import { AssistantAllowance } from "#assistant/application/ports/assistant-allowance.ts";
import { AssistantUsage } from "#assistant/application/ports/assistant-usage.ts";
import { OwnTextCounts } from "#assistant/application/ports/own-text-counts.ts";
import type { OwnTextEndpoint } from "#assistant/application/ports/own-writing-model.ts";
import { TextProviders } from "#assistant/application/ports/text-providers.ts";
import { TextSlots } from "#assistant/application/ports/text-slots.ts";
import { WritingModel } from "#assistant/application/ports/writing-model.ts";
import { TextProviderRefused } from "#assistant/application/text-provider-refused.ts";
import { ownTextRequestsPerDay } from "#assistant/domain/text-provider.ts";
import { usageWindowAt } from "#assistant/domain/usage-window.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { AllowanceReached } from "#shared/domain/allowance-reached.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";

/** One request to the provider, claimed before it is sent. */
export interface RoundClaim {
  /** The provider never ran it: what it took is given back. */
  readonly unsent: Effect.Effect<void>;
  /**
   * The provider had it, and it failed (a timeout, a refusal, an unusable
   * answer, the person gone): forgiven as the assistant's are.
   */
  readonly failed: Effect.Effect<void>;
}

/** Who answers the agent for a run, and how each of its requests counts. */
export interface AgentLease {
  /**
   * Claims one request, before the provider is asked: one of the own
   * provider's of the day, or one of the server's model's (the month's on
   * a server that bills, the day's elsewhere). Uninterruptible.
   */
  readonly claim: Effect.Effect<
    RoundClaim,
    AllowanceReached | AssistantQuotaExceeded | OwnTextExhausted
  >;
  /** The workspace's own text provider, with its key; none for the server's model. */
  readonly endpoint: Option.Option<OwnTextEndpoint>;
  readonly source: "server" | "workspace";
}

const counted: RoundClaim = { failed: Effect.void, unsent: Effect.void };

/**
 * The writing assistant's model, for the agent: exactly as `suggest`
 * chooses it. The workspace's own text provider when it brought one (never
 * the server's model, not even when it fails; never for staff acting as a
 * member; one of the `ownTextAtOnce` slots for the run, and each request
 * counted in its day, whatever it ends with), else the server's language
 * model, each request claimed of the billing account's month on a server
 * that bills (`assistantRequests`, none without a payment method) and of
 * the day's quota elsewhere. Nothing is logged of what is asked.
 */
export class AgentModelAccess extends Context.Service<
  AgentModelAccess,
  {
    /** Opens a run's access to the model, held for the scope. */
    readonly open: (
      actor: Actor
    ) => Effect.Effect<
      AgentLease,
      | AssistantUnavailable
      | MissingPermission
      | OwnTextBusy
      | TextProviderRefused,
      Scope.Scope
    >;
  }
>()("peal-server/assistant/application/AgentModelAccess") {
  static readonly layer = Layer.effect(
    AgentModelAccess,
    Effect.gen(function* AgentModelAccessLive() {
      const providers = yield* TextProviders;
      const slots = yield* TextSlots;
      const ownCounts = yield* OwnTextCounts;
      const model = yield* WritingModel;
      const usage = yield* AssistantUsage;
      const allowance = yield* AssistantAllowance;
      const meters = yield* MeteredUsage;

      // Each of its requests counts in the workspace's day with its own
      // provider, whatever it ends with.
      const ownClaim = (actor: Actor) =>
        Effect.gen(function* claimingOwn() {
          const window = usageWindowAt(yield* DateTime.now);

          const claimed = yield* ownCounts.claim(
            actor.workspaceId,
            window.day,
            ownTextRequestsPerDay
          );

          if (Option.isNone(claimed)) {
            return yield* new OwnTextExhausted({
              dailyLimit: ownTextRequestsPerDay,
              resetsAt: window.resetsAt,
            });
          }

          return counted;
        });

      // One of the billing account's requests this month, and the day's
      // count kept for the usage ledger, as `suggest` claims them.
      const meteredClaim = (actor: Actor) =>
        Effect.gen(function* claimingMetered() {
          const window = usageWindowAt(yield* DateTime.now);

          const claim = yield* meters
            .claim(actor.workspaceId, "assistantRequests", 1)
            .pipe(Effect.catchTag("DatabaseError", Effect.die));

          yield* usage
            .claim(actor.workspaceId, window.day, Number.MAX_SAFE_INTEGER, 1)
            .pipe(
              Effect.onError(() => meters.giveBack(claim).pipe(Effect.orDie))
            );

          const released = usage.release(actor.workspaceId, window.day, 1);

          const round: RoundClaim = {
            failed: meters
              .forgive(claim)
              .pipe(Effect.andThen(released), Effect.orDie),
            unsent: meters
              .giveBack(claim)
              .pipe(Effect.andThen(released), Effect.orDie),
          };

          return round;
        });

      // One of the day's requests, within the workspace's limit, or its
      // pool's on a server that shares a day.
      const dailyClaim = (actor: Actor) =>
        Effect.gen(function* claimingDaily() {
          const window = usageWindowAt(yield* DateTime.now);
          const dailyLimit = yield* allowance.dailyRequests(actor.workspaceId);

          const claimed =
            dailyLimit > 0
              ? yield* usage.claim(
                  actor.workspaceId,
                  window.day,
                  dailyLimit,
                  1,
                  allowance.pooled
                    ? allowance.sharedWith(actor.workspaceId)
                    : undefined
                )
              : Option.none();

          if (Option.isNone(claimed)) {
            return yield* new AssistantQuotaExceeded({
              dailyLimit,
              resetsAt: window.resetsAt,
            });
          }

          const round: RoundClaim = {
            failed: Effect.void,
            unsent: usage.release(actor.workspaceId, window.day, 1),
          };

          return round;
        });

      const open = Effect.fn("AgentModelAccess.open")(function* open(
        actor: Actor
      ) {
        yield* Effect.fromResult(authorize(actor, "assistant:use"));

        const own = yield* providers.open(actor.workspaceId);

        if (Option.isSome(own)) {
          // The workspace's account at its provider pays: never for staff.
          if (
            actor.subject._tag === "user" &&
            Option.isSome(actor.subject.impersonatedBy)
          ) {
            return yield* new MissingPermission({
              permission: "assistant:configure",
            });
          }

          const { apiKey, settings } = own.value;

          if (Option.isNone(apiKey)) {
            return yield* new TextProviderRefused({
              reason: "keyUnreadable",
              status: null,
            });
          }

          if (!(yield* slots.take(actor.workspaceId))) {
            return yield* new OwnTextBusy();
          }

          const lease: AgentLease = {
            claim: Effect.uninterruptible(ownClaim(actor)),
            endpoint: Option.some({
              apiKey: apiKey.value,
              baseUrl: settings.baseUrl,
              kind: settings.kind,
              model: settings.model,
            }),
            source: "workspace",
          };

          return lease;
        }

        if (!model.available) {
          return yield* new AssistantUnavailable();
        }

        const metered = yield* allowance.metered(actor.workspaceId);

        const claim: AgentLease["claim"] = metered
          ? meteredClaim(actor)
          : dailyClaim(actor);

        const lease: AgentLease = {
          claim: Effect.uninterruptible(claim),
          endpoint: Option.none(),
          source: "server",
        };

        return lease;
      });

      return AgentModelAccess.of({ open });
    })
  );
}
