// The header and the footer link only to what exists: docs pages that the
// docs have in every language, and the settings the build was given.
import { existsSync } from "node:fs";
import path from "node:path";

import type { SiteHeaderProps } from "peal-ui/components/site-header";
import { describe, expect, it } from "vitest";

import { defaultLocale, locales } from "../src/i18n/locales.ts";
import type { Locale } from "../src/i18n/locales.ts";
import { messages } from "../src/i18n/messages.ts";
import {
  developerRows,
  footerProps,
  headerProps,
  launchPage,
  platformsPage,
  repository,
  resourceRows,
  studioRows,
} from "../src/navigation.ts";
import type { PageLinks, SiteSettings } from "../src/navigation.ts";
import { sitePlatforms } from "../src/platforms.ts";

const docsRoot = path.join(import.meta.dirname, "../../peal-docs/docs");

const docsPaths = [
  ...[...studioRows, ...developerRows, ...resourceRows].flatMap(({ target }) =>
    "docs" in target ? [target.docs] : []
  ),
  launchPage,
  platformsPage,
  ...sitePlatforms.map((platform) => platform.docs),
];

const pageExists = (locale: Locale, page: string) => {
  const folder =
    locale === defaultLocale ? docsRoot : path.join(docsRoot, locale);

  return (
    existsSync(path.join(folder, `${page}.mdx`)) ||
    existsSync(path.join(folder, page, "index.mdx"))
  );
};

const pages: PageLinks = {
  blog: "/blog",
  home: "/",
  language: (locale) => (locale === "en" ? "/" : `/${locale}/`),
  legal: (document) => `/${document}`,
  locale: "en",
  pricing: "/pricing",
};

const everything: SiteSettings = {
  app: (page) => `https://app.test/${page}`,
  discord: "https://discord.test/invite",
  docs: (page) => `https://docs.test/${page}`,
  stars: "1.2K",
};

// No page has a link: every lookup misses.
const unset: Readonly<Record<string, string>> = {};

const nothing: SiteSettings = {
  app: (page) => unset[page],
  discord: unset["discord"],
  docs: (page) => unset[page],
  stars: unset["stars"],
};

const hrefs = (header: SiteHeaderProps) =>
  header.items.flatMap((item) =>
    item.kind === "link"
      ? [item.href]
      : [
          ...item.groups.flatMap((group) =>
            group.links.map((link) => link.href)
          ),
          ...(item.feature === undefined ? [] : [item.feature.href]),
        ]
  );

const labels = (settings: SiteSettings) =>
  footerProps(messages("en"), pages, settings, []).columns.flatMap((column) =>
    column.links.map((link) => link.label)
  );

describe("the site's navigation", () => {
  it.each(
    locales.flatMap((locale) => docsPaths.map((page) => ({ locale, page })))
  )("links to $page, which the docs have in $locale", ({ locale, page }) => {
    expect(pageExists(locale, page)).toBe(true);
  });

  it("lists every platform the contract has, in its group", () => {
    const header = headerProps(messages("en"), pages, everything);
    const menu = header.items.find((item) => item.label === "Platforms");

    const listed =
      menu?.kind === "menu"
        ? menu.groups.flatMap((group) => group.links.map((link) => link.title))
        : [];

    expect(listed.toSorted()).toStrictEqual(
      sitePlatforms.map((platform) => platform.name).toSorted()
    );
    expect(
      sitePlatforms
        .filter((platform) => platform.group === "chat")
        .map((platform) => platform.name)
    ).toStrictEqual(["Discord", "Telegram"]);
  });

  it("offers every menu and the way into the app with every setting", () => {
    const header = headerProps(messages("en"), pages, everything);

    expect(header.items.map((item) => item.label)).toStrictEqual([
      "Products",
      "Platforms",
      "Resources",
      "Pricing",
      "Docs",
      "Blog",
    ]);
    expect(header.signIn?.href).toBe("https://app.test/sign-in");
    expect(header.getStarted?.href).toBe("https://app.test/sign-up");
    expect(header.discord?.href).toBe(everything.discord);
    expect(header.github?.stars).toBe("1.2K");
    expect(hrefs(header)).toContain(`${repository}/releases`);
    expect(hrefs(header)).toContain("https://docs.test/developers/mcp");
  });

  it("leaves out what the build has no setting for", () => {
    const header = headerProps(messages("en"), pages, nothing);

    expect(header.items.map((item) => item.label)).toStrictEqual([
      "Resources",
      "Pricing",
      "Blog",
    ]);
    expect(header.signIn).toBeUndefined();
    expect(header.getStarted).toBeUndefined();
    expect(header.discord).toBeUndefined();
    expect(header.github?.stars).toBeUndefined();
    expect(hrefs(header).every((href) => !href.includes("docs"))).toBe(true);
    expect(hrefs(header).some((href) => href.includes("discord"))).toBe(false);
  });

  it("lists Discord in the footer only when it is set", () => {
    expect(labels(everything)).toContain("Discord");
    expect(labels(nothing)).not.toContain("Discord");
  });

  it("marks the page's own language in the footer", () => {
    const footer = footerProps(
      messages("fr"),
      { ...pages, locale: "fr" },
      nothing,
      []
    );

    expect(
      footer.languages?.links
        .filter((link) => link.current === true)
        .map((link) => link.lang)
    ).toStrictEqual(["fr"]);
  });
});
