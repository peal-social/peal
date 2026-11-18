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

/** What the SDK was last set to, from the page's start. */
export interface Applied {
  /** How it was started and last switched, none until it was. */
  readonly configured: "anonymous" | "identified" | null;
  /** Whether a recording runs. */
  readonly recording: boolean;
  /** The workspace it names (identified only). */
  readonly workspaceId: string | null;
}

/** Nothing started: the SDK is not even loaded. */
export const notStarted: Applied = {
  configured: null,
  recording: false,
  workspaceId: null,
};

/** What does not change while the page lives. */
export interface MeasuredSession {
  readonly token: string;
  readonly environment: string;
  readonly userId: string;
  readonly hostname: string;
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

// The configured mode, once the SDK runs in `mode`.
const configured = (
  sdk: MeasurementSdk,
  session: MeasuredSession,
  applied: Applied,
  mode: "anonymous" | "identified"
): Applied => {
  if (applied.configured === null) {
    sdk.init(
      session.token,
      initOptionsOf({
        beforeSend: session.beforeSend,
        hostname: session.hostname,
        identified: mode === "identified",
      })
    );
    registerCommon(sdk, session);

    if (mode === "identified") {
      sdk.identify(session.userId);
    }

    return {
      configured: mode,
      recording: mode === "identified",
      workspaceId: null,
    };
  }

  // The person just allowed it: switched in place, so no draft is lost.
  if (applied.configured === "anonymous" && mode === "identified") {
    sdk.set_config(identifiedConfigOf(session.hostname));
    sdk.identify(session.userId);
    sdk.startSessionRecording();

    return { configured: mode, recording: true, workspaceId: null };
  }

  // Withdrawn, or the choice expired: what the SDK stored goes.
  if (applied.configured === "identified" && mode === "anonymous") {
    if (applied.recording) {
      sdk.stopSessionRecording();
    }

    sdk.reset();
    sdk.set_config(anonymousConfig);
    // The reset forgot what every event carries.
    registerCommon(sdk, session);

    return { configured: mode, recording: false, workspaceId: null };
  }

  // Back on a measured page while identified: the recording again.
  if (mode === "identified" && !applied.recording) {
    sdk.startSessionRecording();

    return { ...applied, recording: true };
  }

  return applied;
};

// The workspace an identified page names, or none on a personal page.
const grouped = (
  sdk: MeasurementSdk,
  applied: Applied,
  workspaceId: string | null
): Applied => {
  if (applied.workspaceId === workspaceId) {
    return applied;
  }

  if (workspaceId === null) {
    sdk.resetGroups();
    sdk.unregister("workspace_id");
  } else {
    sdk.group("workspace", workspaceId);
    sdk.register({ workspace_id: workspaceId });
  }

  return { ...applied, workspaceId };
};

/**
 * Sets the SDK to what the page asks, from what it was last set to, and
 * answers what it is set to now. Off before anything started does
 * nothing (the SDK is not loaded); off after a start stops the recording,
 * and `sanitized` drops every event meanwhile. Asking again for the same
 * calls nothing.
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

/** Signing out: nothing the SDK kept of the person stays. */
export const signedOut = (sdk: MeasurementSdk): void => {
  sdk.reset();
};
