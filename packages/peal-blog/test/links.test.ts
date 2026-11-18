// Every link to a blog page follows Astro's base, in both languages.
import { describe, expect, it } from "vitest";

import { blogPath } from "../src/links.ts";

describe("a blog page's path", () => {
  it.each([
    { base: "/blog", locale: "en", path: "", shown: "/blog/" },
    { base: "/blog/", locale: "en", path: "", shown: "/blog/" },
    { base: "/blog", locale: "en", path: "a-post", shown: "/blog/a-post" },
    { base: "/blog", locale: "fr", path: "", shown: "/blog/fr/" },
    {
      base: "/blog",
      locale: "fr",
      path: "un-article",
      shown: "/blog/fr/un-article",
    },
    { base: "/", locale: "en", path: "", shown: "/" },
    { base: "/", locale: "en", path: "a-post", shown: "/a-post" },
    { base: "/", locale: "fr", path: "un-article", shown: "/fr/un-article" },
  ] as const)(
    "is $shown for $path in $locale under $base",
    ({ base, locale, path, shown }) => {
      expect(blogPath(base, locale, path)).toBe(shown);
    }
  );
});
