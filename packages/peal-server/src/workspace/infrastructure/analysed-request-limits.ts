import { DateTime, Effect, Layer, Option } from "effect";

import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import type { Captured } from "#shared/application/product-analytics.ts";
import { RequestLimits } from "#workspace/application/request-limits.ts";
import type { Principal } from "#workspace/domain/principal.ts";

/**
 * How many uses a day are kept, and so told, at most: past it nothing
 * more is told that day, so the memory a day takes is bounded whatever
 * is sent.
 */
export const usesToldADay = 100_000;

// Whose use it is, from what the credential itself carries and nothing a
// request names: this runs before a workspace named in a path is checked
// against the credential, so that one is never read. A key's use is its
// workspace's; an application's is its person's, in the workspace its
// token is bound to, or in none (the command line's). A partner key
// carries no workspace, and a person in their own session is the web
// app's, measured there: neither is told.
const useOf = (
  principal: Principal
): Option.Option<{
  readonly key: string;
  readonly use: Pick<Captured, "actor" | "asWorkspace" | "workspaceId">;
  readonly via: "apiKey" | "oauth";
}> => {
  if (principal._tag === "ApiKeyPrincipal") {
    return Option.some({
      key: `workspace:${principal.workspaceId}:apiKey`,
      use: {
        actor: Option.none(),
        asWorkspace: true,
        workspaceId: Option.some(principal.workspaceId),
      },
      via: "apiKey" as const,
    });
  }

  if (principal._tag === "PartnerKeyPrincipal") {
    return Option.none();
  }

  return principal.oauth.pipe(
    Option.map(({ workspaceId }) => ({
      key: `user:${principal.userId}:${Option.getOrElse(workspaceId, () => "")}:oauth`,
      use: {
        actor: Option.some({
          impersonated: Option.isSome(principal.impersonatedBy),
          userId: principal.userId,
        }),
        asWorkspace: false,
        workspaceId,
      },
      via: "oauth" as const,
    }))
  );
};

/**
 * RequestLimits that also tell product analytics the API or the MCP
 * endpoint was used (`api_used`), reads included, which `api_operation`
 * never sees: once a credential's workspace or person and day (UTC) for
 * this process, on the first request `told` let through, so a day of any
 * number of requests is a few events. A restart tells the day again:
 * readers take one per workspace or person, `via` and `day`. Nothing is
 * counted, and nothing is kept but the day's uses in memory,
 * `usesToldADay` at most.
 */
export const analysedRequestLimits = <E, R>(
  told: Layer.Layer<RequestLimits, E, R>
) =>
  Layer.effect(
    RequestLimits,
    Effect.gen(function* AnalysedRequestLimits() {
      const limits = yield* RequestLimits;
      const analytics = yield* ProductAnalytics;

      // The uses told on `day`, by this process: read and changed in one
      // synchronous step, so requests answered together never tell twice.
      const toldNow = { day: "", seen: new Set<string>() };

      // Whether this is the first of its key on `day`. A day before the
      // one being kept (a request that read the clock just before
      // midnight) is told nothing more.
      const first = (day: string, key: string): boolean => {
        if (day < toldNow.day) {
          return false;
        }

        if (day > toldNow.day) {
          toldNow.day = day;
          toldNow.seen = new Set();
        }

        if (toldNow.seen.has(key) || toldNow.seen.size >= usesToldADay) {
          return false;
        }

        toldNow.seen.add(key);

        return true;
      };

      const tell = (principal: Principal) =>
        Option.match(useOf(principal), {
          onNone: () => Effect.void,
          onSome: ({ key, use, via }) =>
            DateTime.now.pipe(
              Effect.map(DateTime.formatIsoDateUtc),
              Effect.flatMap((day) =>
                first(day, key)
                  ? analytics.capture({
                      ...use,
                      billingAccountId: Option.none(),
                      event: { name: "api_used", properties: { day, via } },
                    })
                  : Effect.void
              )
            ),
        });

      return RequestLimits.of({
        admit: (principal, actingIn) =>
          limits.admit(principal, actingIn).pipe(
            Effect.tap((standing) =>
              analytics.enabled &&
              Option.match(standing, {
                onNone: () => true,
                onSome: ({ allowed }) => allowed,
              })
                ? tell(principal)
                : Effect.void
            )
          ),
      });
    })
  ).pipe(Layer.provide(told));
