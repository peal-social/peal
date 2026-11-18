import type { MeasuredEvent, SanitizeState } from "./sanitize.ts";
import { sanitized } from "./sanitize.ts";
import type { MeasurementSdk } from "./sdk.ts";
import { applyState, notStarted, parked, signedOut } from "./session.ts";
import type { Applied, MeasuredSession, Wanted } from "./session.ts";

/** What a page of the app asks the measurement for. */
export interface Asked {
  readonly session: Omit<MeasuredSession, "beforeSend">;
  readonly wanted: Wanted;
}

/** The web app's measurement, one per page load, as the SDK is. */
export interface MeasurementController {
  /** Applies what a page asks, loading the SDK the first time it measures. */
  readonly ask: (asked: Asked) => Promise<void>;
  /** Leaving the signed-in app: nothing more is measured or recorded. */
  readonly park: () => void;
  /** Signing out: the SDK forgets the person, if it runs. */
  readonly signOut: () => void;
  /** The SDK, once loaded: for the errors handed to it. */
  readonly sdk: () => MeasurementSdk | null;
}

/**
 * The measurement's one holder of the SDK, what was applied to it and the
 * state its `before_send` reads, which outlives the component that drives
 * it: the SDK starts once a page load, so a remount (a language switch,
 * another person signing in, a trip to the staff console) goes on from
 * where the last one left it. A load that fails leaves the page
 * unmeasured.
 */
export const makeController = (
  load: () => Promise<MeasurementSdk>
): MeasurementController => {
  let sdk: MeasurementSdk | null = null;
  let loading = false;
  let applied: Applied = notStarted;
  let latest: Asked | null = null;
  let state: SanitizeState = { mode: "off", userId: "" };

  const beforeSend = (event: MeasuredEvent) => sanitized(event, state);

  const apply = (loaded: MeasurementSdk, asked: Asked) => {
    applied = applyState(
      loaded,
      { ...asked.session, beforeSend },
      applied,
      asked.wanted
    );
  };

  const ask = async (asked: Asked) => {
    latest = asked;
    state = { mode: asked.wanted.mode, userId: asked.session.userId };

    if (sdk !== null) {
      apply(sdk, asked);

      return;
    }

    if (asked.wanted.mode === "off" || loading) {
      return;
    }

    loading = true;

    try {
      const loaded = await load();

      sdk = loaded;

      // The latest ask, whatever changed while the SDK loaded; none once
      // the app was left meanwhile.
      if (latest !== null) {
        apply(loaded, latest);
      }
    } catch {
      // The page stays unmeasured: nothing more to do.
    } finally {
      loading = false;
    }
  };

  const park = () => {
    latest = null;
    state = { ...state, mode: "off" };

    if (sdk !== null) {
      applied = parked(sdk, applied);
    }
  };

  const signOut = () => {
    state = { ...state, mode: "off" };

    if (sdk !== null) {
      applied = signedOut(sdk, applied);
    }
  };

  return { ask, park, sdk: () => sdk, signOut };
};
