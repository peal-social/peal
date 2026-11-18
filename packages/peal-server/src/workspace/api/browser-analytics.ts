import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "peal-contract";

import { forbidden } from "#shared/api/forbidden.ts";
import { BrowserAnalyticsChoice } from "#workspace/application/browser-analytics-choice.ts";

import { currentUser } from "./connected-apps.ts";

export const BrowserAnalyticsHandlers = HttpApiBuilder.group(
  Api,
  "browserAnalytics",
  Effect.fn(function* browserAnalyticsHandlers(handlers) {
    const choice = yield* BrowserAnalyticsChoice;

    return handlers.handleAll({
      setConsent: ({ payload }) =>
        Effect.gen(function* setConsent() {
          const { choice: kept, decidedAt } = yield* choice
            .choose(yield* currentUser, payload.choice)
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                SessionRequired: forbidden,
              })
            );

          return { consent: kept, decidedAt };
        }),
    });
  })
);
