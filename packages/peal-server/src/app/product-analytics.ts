import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";

import { analyticsShutdownTimeout } from "#app/shutdown.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import { postHogDelivery } from "#shared/infrastructure/posthog-delivery.ts";
import { postHogConfig } from "#shared/infrastructure/posthog-settings.ts";
import type { PostHogSettings } from "#shared/infrastructure/posthog-settings.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";

// Events to the operator's PostHog project. The fetch client directly,
// not the public one: the host is the operator's setting, as the writing
// assistant's is.
const postHogAnalytics = (settings: PostHogSettings) =>
  ProductAnalytics.layer.pipe(
    Layer.provide(
      postHogDelivery(settings, { shutdownTimeout: analyticsShutdownTimeout })
    ),
    Layer.provide(
      Layer.succeed(
        AnalyticsScope,
        AnalyticsScope.of({
          environment: settings.environment,
          excludedUsers: settings.excludedUsers,
        })
      )
    ),
    Layer.provide(Layer.merge(FetchHttpClient.layer, IdsLive)),
    Layer.tap(() =>
      Option.isSome(settings.erasure)
        ? Effect.void
        : Effect.logWarning(
            "Product analytics is on without PEAL_POSTHOG_PERSONAL_API_KEY: accounts closed here are not deleted at PostHog, delete them there by hand"
          )
    )
  );

/**
 * Product analytics as the server runs it: to PostHog when
 * PEAL_POSTHOG_KEY is set (`posthog-settings.ts` lists the settings), and
 * nowhere otherwise. One per build of the server: what it queued is sent
 * when it is released, after the HTTP server and the workers.
 */
export const ProductAnalyticsLive = Layer.unwrap(
  postHogConfig.pipe(
    Effect.map(
      Option.match({
        onNone: () => ProductAnalytics.none,
        onSome: postHogAnalytics,
      })
    )
  )
);
