import { describe, expect, it } from "vitest";

import {
  asksNotToBeFollowed,
  siteAnswerAllows,
} from "../../../src/workspace/infrastructure/auth/site-answer.ts";

const now = Date.UTC(2026, 10, 19, 12);
const today = Math.floor(now / 86_400_000);

describe("the site's answer, read by the server", () => {
  it("allows following a visitor whose answer allows it and is under 183 days old", () => {
    expect(siteAnswerAllows(`a=1; peal.consent=1.a.${String(today)}`, now)).toBe(
      true
    );
    expect(
      siteAnswerAllows(`peal.consent=1.a.${String(today - 182)}`, now)
    ).toBe(true);
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
      expect(siteAnswerAllows(header, now)).toBe(false);
    }

    expect(siteAnswerAllows(undefined, now)).toBe(false);
  });

  it("hears Global Privacy Control and Do Not Track", () => {
    expect(asksNotToBeFollowed(new Headers({ "sec-gpc": "1" }))).toBe(true);
    expect(asksNotToBeFollowed(new Headers({ dnt: "1" }))).toBe(true);
    expect(asksNotToBeFollowed(new Headers({ dnt: "0" }))).toBe(false);
    expect(asksNotToBeFollowed(new Headers())).toBe(false);
    expect(asksNotToBeFollowed(undefined)).toBe(false);
  });
});
