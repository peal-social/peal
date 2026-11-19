import type { initOptionsOf } from "./options";

/** The SDK's options, as `initOptionsOf` writes them. */
export type SiteSdkOptions = ReturnType<typeof initOptionsOf>;

/** The part of the SDK the site, the docs and the blog use, which tests record. */
export interface SiteSdk {
  readonly init: (token: string, options: SiteSdkOptions) => void;
  readonly capture: (
    event: string,
    properties: Record<string, boolean | number | string>,
    /** Sent with the browser's beacon, as a page is left. */
    leaving?: boolean
  ) => void;
  readonly opt_in_capturing: () => void;
  readonly opt_out_capturing: () => void;
  readonly get_explicit_consent_status: () => "denied" | "granted" | "pending";
  /** Who the SDK says events are about now. */
  readonly get_distinct_id: () => string;
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
    opt_in_capturing: () => {
      posthog.opt_in_capturing();
    },
    opt_out_capturing: () => {
      posthog.opt_out_capturing();
    },
  };
};
