// The blog shows the site's header and footer, with the site's pages on its
// origin, the blog's under the base, and each language's link on the same
// post where it is translated.
import { describe, expect, it } from "vitest";

import { chromeProps, languageLink } from "../src/chrome.ts";
import { blogSettings } from "../src/config.ts";

const settings = blogSettings({
  BLOG_APP_URL: "https://app.synthetic.test",
  BLOG_DOCS_URL: "https://docs.synthetic.test/",
  BLOG_SITE_URL: "https://synthetic.test/",
});

const links = (props: ReturnType<typeof chromeProps>) =>
  props.footer.columns.flatMap((column) =>
    column.links.map((link) => link.href)
  );

describe("the language links", () => {
  it("leads to the translation where there is one", () => {
    const language = languageLink("/blog", { en: "a-post", fr: "un-article" });

    expect(language("en")).toBe("/blog/a-post");
    expect(language("fr")).toBe("/blog/fr/un-article");
  });

  it("leads to the other language's index where there is none", () => {
    const language = languageLink("/blog", { en: "a-post" });

    expect(language("fr")).toBe("/blog/fr/");
  });

  it("marks the page's own language in the footer", () => {
    const { footer } = chromeProps({
      base: "/blog",
      locale: "fr",
      settings,
      stars: undefined,
      translations: { en: "a-post", fr: "un-article" },
    });

    expect(
      footer.languages?.links.map(({ current, href, lang }) => ({
        current,
        href,
        lang,
      }))
    ).toStrictEqual([
      { current: false, href: "/blog/a-post", lang: "en" },
      { current: true, href: "/blog/fr/un-article", lang: "fr" },
    ]);
  });
});

describe("the header and the footer", () => {
  it("link the site's pages on its origin, in the page's language", () => {
    const props = chromeProps({
      base: "/blog",
      locale: "fr",
      settings,
      stars: 1234,
      translations: {},
    });

    expect(props.header.home.href).toBe("https://synthetic.test/fr/");
    expect(links(props)).toContain("https://synthetic.test/fr/pricing");
    expect(links(props)).toContain("https://synthetic.test/fr/legal");
    expect(links(props)).toContain("/blog/fr/");
    expect(props.header.github?.stars?.replaceAll(/\s/gu, " ")).toBe("1,2 k");
  });

  it("link the site on the same origin without BLOG_SITE_URL", () => {
    const props = chromeProps({
      base: "/blog",
      locale: "en",
      settings: blogSettings({}),
      stars: undefined,
      translations: {},
    });

    expect(props.header.home.href).toBe("/");
    expect(links(props)).toContain("/pricing");
    expect(links(props)).toContain("/blog/");
    expect(props.header.signIn).toBeUndefined();
    expect(props.header.github?.stars).toBeUndefined();
  });
});
