import type { initOptionsOf } from "./options";
import type { SiteEventName } from "./sanitize";

/** The SDK's options, as `initOptionsOf` writes them. */
export type SiteSdkOptions = ReturnType<typeof initOptionsOf>;

/** The part of the SDK the site, the docs and the blog use, which tests record. */
export interface SiteSdk {
  readonly init: (token: string, options: SiteSdkOptions) => void;
  readonly capture: (
    // A name outside the allowlist does not compile: `before_send` would drop it.
    event: SiteEventName,
    properties: Record<string, boolean | number | string>,
    /** Sent with the browser's beacon, as a page is left. */
    leaving?: boolean
  ) => void;
  readonly opt_in_capturing: () => void;
  readonly opt_out_capturing: () => void;
  readonly get_explicit_consent_status: () => "denied" | "granted" | "pending";
  /** Who the SDK says events are about now. */
  readonly get_distinct_id: () => string;
  /**
   * A new visitor, linked to none before, with a new device id. It clears
   * the SDK's consent too: the caller opts in again where the answer allows.
   */
  readonly reset: () => void;
  /**
   * Keeps, as the visit's source in the SDK's cookie, only what is given:
   * the page's address without its query, the referrer's origin.
   */
  readonly keepSessionSource: (source: {
    readonly referrer: string;
    readonly url: string;
  }) => void;
}

/**
 * Loads the SDK's slim build, bundled with the page (nothing fetched from
 * PostHog): page views and leaves with scroll are its core's. The only
 * place that imports `posthog-js`.
 */
export const loadSdk = async (): Promise<SiteSdk> => {
  const { posthog } = await import("posthog-js/dist/module.slim.no-external");

  return {
    capture: (event, properties, leaving = false) => {
      posthog.capture(
        event,
        properties,
        leaving ? { transport: "sendBeacon" } : {}
      );
    },
    get_distinct_id: () => posthog.get_distinct_id(),
    get_explicit_consent_status: () => posthog.get_explicit_consent_status(),
    init: (token, options) => {
      posthog.init(token, {
        ...options,
        // The SDK hands `before_send` nothing once an event was dropped.
        before_send: (event) =>
          event === null ? null : options.before_send(event),
      });
    },
    keepSessionSource: ({ referrer, url }) => {
      posthog.persistence?.register({
        $client_session_props: {
          props: { r: referrer, u: url },
          sessionId: posthog.get_session_id(),
        },
      });
    },
    opt_in_capturing: () => {
      posthog.opt_in_capturing();
    },
    opt_out_capturing: () => {
      posthog.opt_out_capturing();
    },
    reset: () => {
      posthog.reset(true);
    },
  };
};
