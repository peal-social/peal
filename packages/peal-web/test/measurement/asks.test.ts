// When the personal home asks the person about the web app's measurement.
import { describe, expect, it } from "@effect/vitest";

import { asksConsent } from "#measurement/asks.ts";

describe(asksConsent, () => {
  it("asks only where the web app measures and the person has not chosen", () => {
    expect(
      asksConsent({ consent: "undecided", untracked: false })
    ).toBeTruthy();
    expect(asksConsent(null)).toBeFalsy();
    expect(asksConsent({ consent: "granted", untracked: false })).toBeFalsy();
    expect(asksConsent({ consent: "refused", untracked: false })).toBeFalsy();
  });

  it("never asks a browser that asks not to be tracked", () => {
    expect(asksConsent({ consent: "undecided", untracked: true })).toBeFalsy();
  });
});
