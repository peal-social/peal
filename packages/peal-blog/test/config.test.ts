// The blog's settings, read from its environment: unset or blank turns each
// feature off, as the site's do.
import { describe, expect, it } from "vitest";

import { blogEnvironment, blogSettings } from "../src/config.ts";

describe("the blog's settings", () => {
  it("turns every feature off without a setting", () => {
    const settings = blogSettings(blogEnvironment({ PATH: "/usr/bin" }));

    expect(settings.site).toBe("");
    expect(settings.discord).toBeUndefined();
    expect(settings.app("en", "sign-in")).toBeUndefined();
    expect(settings.docs("fr", "")).toBeUndefined();
  });

  it("treats a blank value as unset", () => {
    const settings = blogSettings({
      BLOG_DISCORD_URL: "  ",
      BLOG_SITE_URL: " ",
    });

    expect(settings.site).toBe("");
    expect(settings.discord).toBeUndefined();
  });

  it("reads each setting", () => {
    const settings = blogSettings({
      BLOG_APP_URL: "https://app.synthetic.test/",
      BLOG_DISCORD_URL: "https://discord.synthetic.test/invite",
      BLOG_DOCS_URL: "https://docs.synthetic.test",
      BLOG_SITE_URL: "https://synthetic.test//",
    });

    expect(settings.site).toBe("https://synthetic.test");
    expect(settings.app("fr", "sign-in")).toBe(
      "https://app.synthetic.test/fr/sign-in"
    );
    expect(settings.docs("en", "self-hosting")).toBe(
      "https://docs.synthetic.test/self-hosting"
    );
    expect(settings.discord).toBe("https://discord.synthetic.test/invite");
  });

  it("measures only with a key and a host", () => {
    const host = "/pulse/site";
    const key = "phc_synthetic";

    expect(blogSettings({ BLOG_POSTHOG_KEY: key }).measurement).toBeUndefined();
    expect(
      blogSettings({ BLOG_POSTHOG_HOST: host }).measurement
    ).toBeUndefined();
    expect(
      blogSettings({
        BLOG_POSTHOG_COOKIE_DOMAIN: "synthetic.test",
        BLOG_POSTHOG_HOST: host,
        BLOG_POSTHOG_KEY: key,
      }).measurement
    ).toStrictEqual({
      cookieDomain: "synthetic.test",
      environment: "production",
      host,
      key,
    });
  });

  it("refuses a malformed key", () => {
    expect(() =>
      blogSettings({
        BLOG_POSTHOG_HOST: "/pulse/site",
        BLOG_POSTHOG_KEY: "synthetic",
      })
    ).toThrow(/BLOG_POSTHOG_KEY/u);
  });

  it("reads only the blog's variables from an environment", () => {
    expect(
      blogEnvironment({
        BLOG_SITE_URL: "https://synthetic.test",
        PGPASSWORD: "synthetic-password",
      })
    ).toStrictEqual({ BLOG_SITE_URL: "https://synthetic.test" });
  });
});
