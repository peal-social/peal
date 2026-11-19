import { Context, Layer, Option } from "effect";

/** What a sign-up needs to link the site's visitor to the new account. */
export interface SiteMeasurementSettings {
  /**
   * The product analytics project's token, which names the visitor's
   * cookie (`ph_<token>_posthog`).
   */
  readonly token: string;
  /**
   * The parent domain the cookie is set on, where a sign-up expires it:
   * none for a cookie of the host alone.
   */
  readonly cookieDomain: Option.Option<string>;
}

/**
 * Whether a sign-up links the visitor that the site, the docs and the blog
 * followed, once they allowed it, to the new account (product analytics
 * on, and PEAL_POSTHOG_SITE on), and with what: none otherwise. The
 * application reads no configuration; the composition root provides it
 * with product analytics.
 */
export class SiteMeasurement extends Context.Service<
  SiteMeasurement,
  { readonly settings: Option.Option<SiteMeasurementSettings> }
>()("peal-server/shared/application/SiteMeasurement") {
  /** No sign-up links a visitor. */
  static readonly none = Layer.succeed(
    SiteMeasurement,
    SiteMeasurement.of({ settings: Option.none() })
  );
}
