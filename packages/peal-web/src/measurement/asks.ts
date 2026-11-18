/** What the consent card depends on, none where nothing is measured. */
export interface ConsentState {
  readonly consent: "granted" | "refused" | "undecided";
  /** Whether the browser asks not to be tracked. */
  readonly untracked: boolean;
}

/**
 * Whether the personal home asks: only where the web app measures, the
 * person has not chosen (or their choice expired), and the browser does
 * not ask not to be tracked, as nothing is measured there.
 */
export const asksConsent = (state: ConsentState | null): boolean =>
  state !== null && !state.untracked && state.consent === "undecided";
