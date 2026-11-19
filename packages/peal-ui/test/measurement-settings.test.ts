import { describe, expect, it } from "vitest";

import { measurementSettings } from "../src/lib/site/measurement/settings";

const key = "phc_synthetic";

describe("the site's measurement settings", () => {
  it("are on only with a key and a host", () => {
    expect(measurementSettings({ prefix: "SITE" })).toBeUndefined();
    expect(measurementSettings({ key, prefix: "SITE" })).toBeUndefined();
    expect(
      measurementSettings({ host: "/pulse/site", prefix: "SITE" })
    ).toBeUndefined();
    expect(
      measurementSettings({ host: "/pulse/site", key, prefix: "SITE" })
    ).toStrictEqual({
      cookieDomain: undefined,
      environment: "production",
      host: "/pulse/site",
      key,
    });
  });

  it("treat a blank value as unset", () => {
    expect(
      measurementSettings({ host: "  ", key, prefix: "SITE" })
    ).toBeUndefined();
    expect(
      measurementSettings({
        cookieDomain: " ",
        environment: "",
        host: "/pulse/site",
        key,
        prefix: "SITE",
      })
    ).toStrictEqual({
      cookieDomain: undefined,
      environment: "production",
      host: "/pulse/site",
      key,
    });
  });

  it("take a path on the same origin or an https origin", () => {
    expect(
      measurementSettings({
        cookieDomain: "Peal.Social",
        environment: "e2e",
        host: "https://eu.i.posthog.com/",
        key,
        prefix: "DOCS",
      })
    ).toStrictEqual({
      cookieDomain: "peal.social",
      environment: "e2e",
      host: "https://eu.i.posthog.com",
      key,
    });
    expect(
      measurementSettings({
        host: "http://localhost:8010",
        key,
        prefix: "SITE",
      })?.host
    ).toBe("http://localhost:8010");
  });

  it("refuse a relative host without its slash, http elsewhere, and a malformed key", () => {
    for (const host of [
      "pulse/site",
      "http://example.com",
      "https://example.com/ingest?x=1",
      "https://user:secret@example.com",
      "/pulse/../site",
      "ftp://example.com",
    ]) {
      expect(() => measurementSettings({ host, key, prefix: "SITE" })).toThrow(
        /SITE_POSTHOG_HOST/u
      );
    }

    for (const bad of ["synthetic", "phc_", "phc_a-b", "phx_synthetic"]) {
      expect(() =>
        measurementSettings({ host: "/pulse/site", key: bad, prefix: "BLOG" })
      ).toThrow(/BLOG_POSTHOG_KEY/u);
    }

    expect(() =>
      measurementSettings({
        cookieDomain: "https://peal.social",
        host: "/pulse/site",
        key,
        prefix: "SITE",
      })
    ).toThrow(/SITE_POSTHOG_COOKIE_DOMAIN/u);
  });
});
