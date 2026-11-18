import type { Mode } from "./mode.ts";
import {
  anonymousConfig,
  identifiedConfigOf,
  initOptionsOf,
} from "./options.ts";
import type { MeasuredEvent } from "./sanitize.ts";
import type { MeasurementSdk } from "./sdk.ts";

/** What a page asks of the SDK: its mode, and the workspace it is in. */
export interface Wanted {
  readonly mode: Mode;
  readonly workspaceId: string | null;
}

/**
 * What the SDK was last set to. The SDK is one per page load, so this
 * outlives the component that measures: a remount, another person signing
 * in in the same tab, a language switch.
 */
export interface Applied {
  /** How it was started and last switched, none until it was. */
  readonly configured: "anonymous" | "identified" | null;
  /**
   * The person it last measured, named or not: another one in the tab
   * starts from a new browser id.
   */
  readonly userId: string | null;
  /**
   * Set aside off the signed-in app: in memory, no recording, no tracing
   * header, nothing in the browser's storage.
   */
  readonly parked: boolean;
  /** Whether a recording runs. */
  readonly recording: boolean;
  /** The workspace it names (identified only), once groups were set. */
  readonly workspaceId: string | null;
  /** Whether its groups were set since it was last identified. */
  readonly grouped: boolean;
}

/** Nothing started: the SDK is not even loaded. */
export const notStarted: Applied = {
  configured: null,
  grouped: false,
  parked: false,
  recording: false,
  userId: null,
  workspaceId: null,
};

/** What a page measures with. */
export interface MeasuredSession {
  readonly token: string;
  readonly environment: string;
  readonly userId: string;
  readonly hostname: string;
  readonly origin: string;
  readonly beforeSend: (event: MeasuredEvent) => MeasuredEvent | null;
}

// What every event carries, the SDK's own aside.
const registerCommon = (sdk: MeasurementSdk, session: MeasuredSession) => {
  sdk.register({
    $geoip_disable: true,
    environment: session.environment,
    source: "web",
  });
};

const anonymous: Applied = { ...notStarted, configured: "anonymous" };

/**
 * Forgets everyone the SDK knew: a new browser id, nothing in the
 * browser's storage, in memory, no recording, no tracing header. Nothing
 * of one person or one consent carries over to the next.
 */
const forgotten = (
  sdk: MeasurementSdk,
  session: MeasuredSession,
  applied: Applied
): Applied => {
  if (applied.recording) {
    sdk.stopSessionRecording();
  }

  sdk.reset(true);
  sdk.set_config(anonymousConfig);
  sdk.clearStorage();
  registerCommon(sdk, session);

  return { ...anonymous, userId: session.userId };
};

// The SDK started for the first time, in `mode`.
const started = (
  sdk: MeasurementSdk,
  session: MeasuredSession,
  mode: "anonymous" | "identified"
): Applied => {
  sdk.init(
    session.token,
    initOptionsOf({
      beforeSend: session.beforeSend,
      hostname: session.hostname,
      identified: mode === "identified",
      origin: session.origin,
    })
  );

  // What the browser's storage held came from someone else, or from
  // before they allowed it: a new browser id rather than theirs.
  if (mode === "identified" && sdk.get_distinct_id() !== session.userId) {
    sdk.reset(true);
  }

  registerCommon(sdk, session);

  if (mode === "anonymous") {
    return { ...anonymous, userId: session.userId };
  }

  sdk.identify(session.userId);

  return {
    ...notStarted,
    configured: "identified",
    recording: true,
    userId: session.userId,
  };
};

// The person allowed it: a new browser id first, so the anonymous one is
// never merged into theirs, then switched in place, so no draft is lost.
const allowed = (sdk: MeasurementSdk, session: MeasuredSession): Applied => {
  sdk.reset(true);
  sdk.set_config(identifiedConfigOf(session.hostname));
  registerCommon(sdk, session);
  sdk.identify(session.userId);
  sdk.startSessionRecording();

  return {
    ...notStarted,
    configured: "identified",
    recording: true,
    userId: session.userId,
  };
};

// The configured mode, once the SDK runs in `mode`.
const configured = (
  sdk: MeasurementSdk,
  session: MeasuredSession,
  applied: Applied,
  mode: "anonymous" | "identified"
): Applied => {
  if (applied.configured === null) {
    return started(sdk, session, mode);
  }

  // Another person in this tab: nothing of the one before carries over.
  const current =
    applied.userId !== null && applied.userId !== session.userId
      ? forgotten(sdk, session, applied)
      : applied;

  if (mode === "anonymous") {
    // Withdrawn, or the choice expired.
    if (current.configured === "identified") {
      return forgotten(sdk, session, current);
    }

    // Back from aside, maybe after a sign-out that forgot what every
    // event carries.
    if (current.parked) {
      registerCommon(sdk, session);
    }

    return { ...current, parked: false, userId: session.userId };
  }

  if (current.configured === "anonymous") {
    return allowed(sdk, session);
  }

  // Back on a measured page while identified.
  if (current.parked) {
    sdk.set_config(identifiedConfigOf(session.hostname));
  }

  if (!current.recording) {
    sdk.startSessionRecording();
  }

  return { ...current, parked: false, recording: true };
};

// The workspace an identified page names, or none on a personal page:
// set once after each identification, then on each change.
const grouped = (
  sdk: MeasurementSdk,
  applied: Applied,
  workspaceId: string | null
): Applied => {
  if (applied.grouped && applied.workspaceId === workspaceId) {
    return applied;
  }

  if (workspaceId === null) {
    sdk.resetGroups();
    sdk.unregister("workspace_id");
  } else {
    sdk.group("workspace", workspaceId);
    sdk.register({ workspace_id: workspaceId });
  }

  return { ...applied, grouped: true, workspaceId };
};

/**
 * Sets the SDK to what the page asks, from what it was last set to, and
 * answers what it is set to now. Off before anything started does
 * nothing (the SDK is not loaded); off on a page of the app stops the
 * recording, and `sanitized` drops every event meanwhile. Asking again
 * for the same calls nothing.
 */
export const applyState = (
  sdk: MeasurementSdk,
  session: MeasuredSession,
  applied: Applied,
  wanted: Wanted
): Applied => {
  if (wanted.mode === "off") {
    if (applied.recording) {
      sdk.stopSessionRecording();

      return { ...applied, recording: false };
    }

    return applied;
  }

  const now = configured(sdk, session, applied, wanted.mode);

  return wanted.mode === "identified"
    ? grouped(sdk, now, wanted.workspaceId)
    : now;
};

/**
 * Leaving the signed-in app: no recording, no tracing header, in memory,
 * nothing left in the browser's storage, until a page of the app asks
 * again.
 */
export const parked = (sdk: MeasurementSdk, applied: Applied): Applied => {
  if (applied.configured === null || applied.parked) {
    return applied;
  }

  if (applied.recording) {
    sdk.stopSessionRecording();
  }

  sdk.set_config(anonymousConfig);
  sdk.clearStorage();

  return { ...applied, parked: true, recording: false };
};

/**
 * Signing out: nothing the SDK kept of the person stays, in memory or in
 * the browser, and it writes nothing more there.
 */
export const signedOut = (sdk: MeasurementSdk, applied: Applied): Applied => {
  if (applied.recording) {
    sdk.stopSessionRecording();
  }

  sdk.reset(true);
  sdk.set_config(anonymousConfig);
  sdk.clearStorage();

  return { ...anonymous, parked: true };
};
