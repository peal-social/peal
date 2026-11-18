import { Context, DateTime, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type {
  BrowserAnalyticsChoice as Choice,
  BrowserAnalyticsConsent,
} from "#workspace/domain/browser-analytics-consent.ts";
import { ownSession } from "#workspace/domain/own-session.ts";
import type { SessionRequired } from "#workspace/domain/session-required.ts";
import type { UserPrincipal } from "#workspace/domain/user-principal.ts";

import { BrowserAnalyticsConsents } from "./browser-analytics-consents.ts";

/**
 * A person's choice about how the web app measures its use, which only
 * they make, in their own session: never an application, nor staff acting
 * as them. It is dated on the server's clock, and kept whether or not the
 * server measures.
 */
export class BrowserAnalyticsChoice extends Context.Service<
  BrowserAnalyticsChoice,
  {
    readonly choose: (
      principal: UserPrincipal,
      choice: Choice
    ) => Effect.Effect<
      BrowserAnalyticsConsent,
      DatabaseError | SessionRequired
    >;
  }
>()("peal-server/workspace/application/BrowserAnalyticsChoice") {
  static readonly layer = Layer.effect(
    BrowserAnalyticsChoice,
    Effect.gen(function* BrowserAnalyticsChoiceLive() {
      const consents = yield* BrowserAnalyticsConsents;

      const choose = Effect.fn("BrowserAnalyticsChoice.choose")(
        function* choose(principal: UserPrincipal, choice: Choice) {
          const userId = yield* Effect.fromResult(ownSession(principal));
          const consent = { choice, decidedAt: yield* DateTime.now };

          yield* consents.keep(userId, consent);

          return consent;
        }
      );

      return BrowserAnalyticsChoice.of({ choose });
    })
  );
}
