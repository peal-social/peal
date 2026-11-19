import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { analyticsShutdownTimeout } from "#app/shutdown.ts";
import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import { BrowserMeasurement } from "#shared/application/browser-measurement.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import { postHogDelivery } from "#shared/infrastructure/posthog-delivery.ts";
import { postHogConfig } from "#shared/infrastructure/posthog-settings.ts";
import type { PostHogSettings } from "#shared/infrastructure/posthog-settings.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import {
  ForgetAnalyticsV1Live,
  WorkflowAnalyticsErasures,
} from "#shared/infrastructure/workflows/forget-analytics.ts";

// The web app measures its use only where PEAL_POSTHOG_WEB is on too,
// with the project's token, public by design.
const browserMeasurementOf = (settings: PostHogSettings) =>
  Layer.succeed(
    BrowserMeasurement,
    BrowserMeasurement.of({
      settings: settings.web
        ? Option.some({
            environment: settings.environment,
            excluded: settings.excluded,
            token: Redacted.value(settings.key),
          })
        : Option.none(),
    })
  );

// Events to the operator's PostHog project. The fetch client directly,
// not the public one: the host is the operator's setting, as the writing
// assistant's is.
const postHogAnalytics = (settings: PostHogSettings) =>
  ProductAnalytics.layer.pipe(
    Layer.provide(WorkflowAnalyticsErasures),
    Layer.provide(
      Layer.succeed(
        AnalyticsScope,
        AnalyticsScope.of({
          environment: settings.environment,
          excluded: settings.excluded,
        })
      )
    ),
    Layer.provideMerge(
      postHogDelivery(settings, {
        shutdownTimeout: analyticsShutdownTimeout,
      }).pipe(Layer.provide(Layer.merge(FetchHttpClient.layer, IdsLive)))
    ),
    Layer.merge(browserMeasurementOf(settings)),
    Layer.tap(() =>
      Option.isSome(settings.erasure)
        ? Effect.void
        : Effect.logWarning(
            "Product analytics is on without PEAL_POSTHOG_PERSONAL_API_KEY: accounts closed here are not deleted at PostHog, delete them there by hand"
          )
    )
  );

// Off: nothing is sent, and a deletion left from when it was on deletes
// nothing more.
const noAnalytics = Layer.mergeAll(
  ProductAnalytics.none,
  AnalyticsDelivery.none,
  BrowserMeasurement.none
);

/**
 * Product analytics as the server runs it: to PostHog when
 * PEAL_POSTHOG_KEY is set (`posthog-settings.ts` lists the settings), and
 * nowhere otherwise, with whether the web app measures its use too
 * (BrowserMeasurement), and the durable deletion of erased persons
 * (ForgetAnalyticsV1) registered on the workflow engine the server runs.
 * One per build of the server: what it queued is sent when it is
 * released, after the HTTP server and the workers. Needs the
 * WorkflowEngine.
 */
export const ProductAnalyticsLive = ForgetAnalyticsV1Live.pipe(
  Layer.provideMerge(
    Layer.unwrap(
      postHogConfig.pipe(
        Effect.map(
          Option.match({
            onNone: () => noAnalytics,
            onSome: postHogAnalytics,
          })
        )
      )
    )
  )
);
