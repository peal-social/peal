import type { BrowserAnalytics } from "peal-contract";

import type { Place } from "./place.ts";

/**
 * How the web app measures the page it shows:
 *
 * - `off`: nothing leaves the browser.
 * - `anonymous`: page views under a random id kept in memory, the
 *   browser's family and the screen's size, and redacted errors; nothing
 *   stored in the browser, no account, no workspace, no recording.
 * - `identified`: the same under the person's account, with the
 *   workspace, a session kept in the browser's storage, a masked
 *   recording, and the session named to Peal's API.
 */
export type Mode = "anonymous" | "identified" | "off";

/** What the browser says of tracking: Do Not Track, Global Privacy Control. */
export interface PrivacySignals {
  readonly doNotTrack: boolean;
  readonly globalPrivacyControl: boolean;
}

/**
 * The mode of a page: `off` where the server measures nothing for this
 * person (`settings` null or absent: no key, PEAL_POSTHOG_WEB off, staff
 * acting as them, an excluded person), outside the signed-in app, in an
 * excluded workspace, and wherever the browser asks not to be tracked;
 * `identified` once the person allowed it, `anonymous` otherwise.
 */
export const modeOf = ({
  place,
  settings,
  signals,
}: {
  readonly place: Place | null;
  readonly settings:
    | Pick<BrowserAnalytics, "consent" | "excludedWorkspaceIds">
    | null
    | undefined;
  readonly signals: PrivacySignals;
}): Mode => {
  if (
    settings === null ||
    settings === undefined ||
    place === null ||
    signals.doNotTrack ||
    signals.globalPrivacyControl
  ) {
    return "off";
  }

  if (
    place.workspaceId !== null &&
    settings.excludedWorkspaceIds.includes(place.workspaceId)
  ) {
    return "off";
  }

  return settings.consent === "granted" ? "identified" : "anonymous";
};
