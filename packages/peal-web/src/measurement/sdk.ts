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
  /** Forgets the person; with `newDevice`, the browser's id too. */
  readonly reset: (newDevice: boolean) => void;
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
  /** Who the SDK says events are about now. */
  readonly get_distinct_id: () => string;
  /**
   * Removes what the SDK keeps in the browser's storage (its `ph_` keys),
   * once the person withdrew or signed out.
   */
  readonly clearStorage: () => void;
}

// What the SDK writes to the browser's storage: `ph_<token>_…` keys.
const isTheSdks = (key: string) =>
  key.startsWith("ph_") || key.startsWith("__ph");

const clearStorage = () => {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage).filter(isTheSdks)) {
      storage.removeItem(key);
    }
  }
};

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
    clearStorage,
    get_distinct_id: () => posthog.get_distinct_id(),
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
    reset: (newDevice) => {
      posthog.reset(newDevice);
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
