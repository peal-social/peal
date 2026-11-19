import type { initOptionsOf } from "./options";

/** The SDK's options, as `initOptionsOf` writes them. */
export type SiteSdkOptions = ReturnType<typeof initOptionsOf>;

/** The part of the SDK the site, the docs and the blog use, which tests record. */
export interface SiteSdk {
  readonly init: (token: string, options: SiteSdkOptions) => void;
  readonly capture: (
    event: string,
    properties: Record<string, boolean | number | string>
  ) => void;
  readonly register: (properties: Record<string, boolean | string>) => void;
  readonly opt_in_capturing: () => void;
  readonly opt_out_capturing: () => void;
  readonly get_explicit_consent_status: () => "denied" | "granted" | "pending";
  /** Who the SDK says events are about now. */
  readonly get_distinct_id: () => string;
}

/**
 * Loads the SDK's slim build, bundled with the page (nothing fetched from
 * PostHog), with web vitals' own callbacks and the one extension that
 * captures them: page views and leaves are the core's. The only place
 * that imports `posthog-js`.
 */
export const loadSdk = async (): Promise<SiteSdk> => {
  const [{ posthog }, { AnalyticsExtensions }] = await Promise.all([
    import("posthog-js/dist/module.slim.no-external"),
    import("posthog-js/dist/extension-bundles"),
    // Registers web vitals' callbacks where the extension looks for them.
    import("posthog-js/dist/web-vitals"),
  ]);

  return {
    capture: (event, properties) => {
      posthog.capture(event, properties);
    },
    get_distinct_id: () => posthog.get_distinct_id(),
    get_explicit_consent_status: () => posthog.get_explicit_consent_status(),
    init: (token, options) => {
      posthog.init(token, {
        ...options,
        // The SDK hands `before_send` nothing once an event was dropped.
        before_send: (event) =>
          event === null ? null : options.before_send(event),
        __extensionClasses: {
          webVitalsAutocapture: AnalyticsExtensions.webVitalsAutocapture,
        },
      });
    },
    opt_in_capturing: () => {
      posthog.opt_in_capturing();
    },
    opt_out_capturing: () => {
      posthog.opt_out_capturing();
    },
    register: (properties) => {
      posthog.register(properties);
    },
  };
};
