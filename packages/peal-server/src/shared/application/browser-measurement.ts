import { Context, Layer, Option } from "effect";

/** What the web app needs to measure its use, where the server lets it. */
export interface BrowserMeasurementSettings {
  /**
   * The product analytics project's token: a public token that only
   * writes events, which the browser sends with each.
   */
  readonly token: string;
  /** The `environment` of every event. */
  readonly environment: string;
  /** Users and workspaces nothing is measured of, by id. */
  readonly excluded: ReadonlySet<string>;
}

/**
 * Whether the web app measures its use in the browser (product analytics
 * on, and PEAL_POSTHOG_WEB on), and with what: none otherwise. The
 * application reads no configuration; the composition root provides it
 * with product analytics.
 */
export class BrowserMeasurement extends Context.Service<
  BrowserMeasurement,
  { readonly settings: Option.Option<BrowserMeasurementSettings> }
>()("peal-server/shared/application/BrowserMeasurement") {
  /** The web app measures nothing. */
  static readonly none = Layer.succeed(
    BrowserMeasurement,
    BrowserMeasurement.of({ settings: Option.none() })
  );
}
