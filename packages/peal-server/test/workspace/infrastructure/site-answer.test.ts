import { describe, expect, it } from "vitest";

import {
  asksNotToBeFollowed,
  siteAnswerAllows,
} from "#workspace/infrastructure/auth/site-answer.ts";

const now = Date.UTC(2026, 10, 19, 12);
const today = Math.floor(now / 86_400_000);

describe("the site's answer, read by the server", () => {
  it("allows following a visitor whose answer allows it and is under 183 days old", () => {
    expect(
      siteAnswerAllows(`a=1; peal.consent=1.a.${String(today)}`, now)
    ).toBeTruthy();
    expect(
      siteAnswerAllows(`peal.consent=1.a.${String(today - 182)}`, now)
    ).toBeTruthy();
  });

  it("refuses an answer 183 days old, a refusal, garbage and none", () => {
    for (const header of [
      `peal.consent=1.a.${String(today - 183)}`,
      `peal.consent=1.r.${String(today)}`,
      `peal.consent=1.a.${String(today + 2)}`,
      "peal.consent=allowed",
      "peal.consent=1.a.",
      "ph_phc_synthetic_posthog=%7B%7D",
      "",
    ]) {
      expect(siteAnswerAllows(header, now)).toBeFalsy();
    }

    expect(siteAnswerAllows(undefined, now)).toBeFalsy();
  });

  it("hears Global Privacy Control and Do Not Track", () => {
    expect(asksNotToBeFollowed(new Headers({ "sec-gpc": "1" }))).toBeTruthy();
    expect(asksNotToBeFollowed(new Headers({ dnt: "1" }))).toBeTruthy();
    expect(asksNotToBeFollowed(new Headers({ dnt: "0" }))).toBeFalsy();
    expect(asksNotToBeFollowed(new Headers())).toBeFalsy();
    expect(asksNotToBeFollowed(undefined)).toBeFalsy();
  });
});
