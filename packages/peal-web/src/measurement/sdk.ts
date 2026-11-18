import type { ExceptionProperties } from "./exceptions.ts";
import type {
  anonymousConfig,
  identifiedConfigOf,
  initOptionsOf,
} from "./options.ts";

/** The SDK's options, as `initOptionsOf` writes them. */
export type SdkOptions = ReturnType<typeof initOptionsOf>;

/** What changes in place between the two measured modes. */
export type SdkSwitch =
  | ReturnType<typeof identifiedConfigOf>
  | typeof anonymousConfig;

/** The part of the SDK the web app uses, which tests record. */
export interface MeasurementSdk {
  readonly init: (token: string, options: SdkOptions) => void;
  readonly identify: (distinctId: string) => void;
  readonly reset: () => void;
  readonly group: (type: string, key: string) => void;
  readonly resetGroups: () => void;
  readonly register: (properties: Record<string, boolean | string>) => void;
  readonly unregister: (property: string) => void;
  readonly set_config: (config: SdkSwitch) => void;
  readonly startSessionRecording: () => void;
  readonly stopSessionRecording: () => void;
  readonly captureException: (
    error: Error,
    properties: ExceptionProperties
  ) => void;
  readonly get_session_id: () => string;
}

/**
 * Loads the SDK, pinned and bundled with the app (session replay and
 * tracing headers inlined, no script loader): nothing is fetched from
 * PostHog at run time, and its code is downloaded only once a page is
 * measured. The only place that imports it.
 */
export const loadSdk = async (): Promise<MeasurementSdk> => {
  const { default: posthog } = await import("posthog-js/full/no-external");

  return {
    captureException: (error, properties) => {
      posthog.captureException(error, properties);
    },
    get_session_id: () => posthog.get_session_id(),
    group: (type, key) => {
      posthog.group(type, key);
    },
    identify: (distinctId) => {
      posthog.identify(distinctId);
    },
    init: (token, options) => {
      posthog.init(token, options);
    },
    register: (properties) => {
      posthog.register(properties);
    },
    reset: () => {
      posthog.reset();
    },
    resetGroups: () => {
      posthog.resetGroups();
    },
    set_config: (config) => {
      posthog.set_config(config);
    },
    startSessionRecording: () => {
      posthog.startSessionRecording();
    },
    stopSessionRecording: () => {
      posthog.stopSessionRecording();
    },
    unregister: (property) => {
      posthog.unregister(property);
    },
  };
};
