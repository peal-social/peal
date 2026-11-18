import { Context, DateTime, Effect, Layer, Option, Result } from "effect";

import { BrowserMeasurement } from "#shared/application/browser-measurement.ts";
import { standingConsent } from "#workspace/domain/browser-analytics-consent.ts";
import { ownSession } from "#workspace/domain/own-session.ts";
import type { Principal } from "#workspace/domain/principal.ts";

import { BrowserAnalyticsConsents } from "./browser-analytics-consents.ts";

/**
 * Which web app session a request's events join: the one its browser
 * named, only for a person in their own session, while the web app is
 * measured and their consent stands. Anything else joins none, and
 * nothing here ever refuses a request.
 */
export class BrowserSessions extends Context.Service<
  BrowserSessions,
  {
    readonly joined: (
      principal: Principal,
      named: Option.Option<string>
    ) => Effect.Effect<Option.Option<string>>;
  }
>()("peal-server/workspace/application/BrowserSessions") {
  static readonly layer = Layer.effect(
    BrowserSessions,
    Effect.gen(function* BrowserSessionsLive() {
      const { settings } = yield* BrowserMeasurement;
      const consents = yield* BrowserAnalyticsConsents;

      const joined = (principal: Principal, named: Option.Option<string>) =>
        Effect.gen(function* joining() {
          if (
            Option.isNone(named) ||
            Option.isNone(settings) ||
            principal._tag !== "UserPrincipal"
          ) {
            return Option.none<string>();
          }

          const own = ownSession(principal);

          if (Result.isFailure(own)) {
            return Option.none<string>();
          }

          const consent = yield* consents.read(own.success);
          const standing = standingConsent(consent, yield* DateTime.now);

          return Option.exists(standing, ({ choice }) => choice === "granted")
            ? named
            : Option.none<string>();
        }).pipe(
          // A consent that cannot be read joins nothing.
          Effect.catchTag("DatabaseError", () =>
            Effect.succeed(Option.none<string>())
          )
        );

      return BrowserSessions.of({ joined });
    })
  );
}
