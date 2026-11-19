import { afterEach, describe, expect, it, vi } from "vitest";

import { holdsVisitor } from "../src/lib/site/consent/forget";

const key = "phc_synthetic";

const withCookies = (cookie: string) => {
  vi.stubGlobal("document", { cookie });
};

describe("holdsVisitor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tells PostHog's cookie for the project by its name", () => {
    withCookies(
      "peal.consent=1.a.20776; ph_phc_synthetic_posthog=%7B%22distinct_id%22%3A%22x%22%7D"
    );

    expect(holdsVisitor(key)).toBe(true);
  });

  it("holds a cookie whose value does not decode", () => {
    withCookies("peal.consent=1.a.20776; ph_phc_synthetic_posthog=%E0%A4%A");

    expect(holdsVisitor(key)).toBe(true);
  });

  it("holds none without the cookie, another project's or a longer name", () => {
    withCookies(
      "peal.consent=1.a.20776; ph_phc_other_posthog=%7B%7D; ph_phc_synthetic_posthog_x=1"
    );

    expect(holdsVisitor(key)).toBe(false);
  });

  it("holds none in an empty jar", () => {
    withCookies("");

    expect(holdsVisitor(key)).toBe(false);
  });
});
