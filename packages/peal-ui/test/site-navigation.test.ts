// The header and the footer link only to what exists: docs pages that the
// docs have in every language, and the settings the build was given.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { AdNetworkSchema, ChannelPlatformSchema } from "peal-contract";
import { describe, expect, it } from "vitest";

import type { SiteHeaderProps } from "../src/components/site-header";
import { defaultLocale, locales } from "../src/lib/site/locales";
import type { Locale } from "../src/lib/site/locales";
import { chromeMessages as messages } from "../src/lib/site/messages";
import {
  developerRows,
  footerProps,
  headerProps,
  launchPage,
  platformsPage,
  repository,
  resourceRows,
  studioRows,
} from "../src/lib/site/navigation";
import type { PageLinks, SiteSettings } from "../src/lib/site/navigation";
import { adEntryOf, entryOf, siteEntries } from "../src/lib/site/platforms";

const docsRoot = path.join(import.meta.dirname, "../../peal-docs/docs");

const docsPaths = [
  ...[...studioRows, ...developerRows, ...resourceRows].flatMap(({ target }) =>
    "docs" in target ? [target.docs] : []
  ),
  launchPage,
  platformsPage,
  ...siteEntries.map((entry) => entry.docs),
];

// A link may name a heading of its page (`page#anchor`): the page must exist.
const pageExists = (locale: Locale, link: string) => {
  const folder =
    locale === defaultLocale ? docsRoot : path.join(docsRoot, locale);

  const [page = link] = link.split("#");

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

  it("lists every platform the contract has, once each, in its group", () => {
    const header = headerProps(messages("en"), pages, everything);
    const menu = header.items.find((item) => item.label === "Platforms");

    const listed =
      menu?.kind === "menu"
        ? menu.groups.flatMap((group) => group.links.map((link) => link.title))
        : [];

    expect(listed.toSorted()).toStrictEqual(
      siteEntries.map((entry) => entry.name).toSorted()
    );
    expect(new Set(listed).size).toBe(listed.length);

    for (const platform of ChannelPlatformSchema.literals) {
      expect(listed).toContain(entryOf(platform).name);
    }

    for (const network of AdNetworkSchema.literals) {
      expect(listed).toContain(adEntryOf(network).name);
    }

    expect(
      menu?.kind === "menu" ? menu.groups.map((group) => group.label) : []
    ).toStrictEqual(["Social", "Chat", "Ads", "Blog"]);
  });

  it.each(locales)(
    "names the Products menu's groups after the two products in %s",
    (locale) => {
      const header = headerProps(messages(locale), pages, everything);
      const menu = header.items.find((item) => item.kind === "menu");

      expect(
        menu?.kind === "menu" ? menu.groups.map((group) => group.label) : []
      ).toStrictEqual(["PealStudio", "PealAPI"]);
      expect(
        menu?.kind === "menu"
          ? menu.groups.every((group) => group.description !== undefined)
          : false
      ).toBe(true);
    }
  );

  it("makes both kinds of WordPress site one entry", () => {
    expect(entryOf("wordpress")).toStrictEqual(entryOf("wordpressCom"));
    expect(
      siteEntries.filter((entry) => entry.name === "WordPress")
    ).toHaveLength(1);
  });

  it("offers every menu and the way into the app with every setting", () => {
    const header = headerProps(messages("en"), pages, everything);

    expect(header.items.map((item) => item.label)).toStrictEqual([
      "Products",
      "Platforms",
      "Resources",
      "Pricing",
      "Docs",
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
    ]);
    // The blog is the site's own page: its link needs no setting.
    expect(hrefs(header)).toContain(pages.blog);
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

  it.each(locales)(
    "leads Cookie settings to a section of the privacy policy in %s",
    (locale) => {
      const policy = readFileSync(
        path.join(
          import.meta.dirname,
          `../../peal-site/src/content/legal/${locale}/privacy.md`
        ),
        "utf-8"
      );

      // A heading's id is its text in lower case, spaces as hyphens.
      const ids = policy
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => line.slice(3).toLowerCase().replaceAll(" ", "-"));

      expect(ids).toContain(messages(locale).footer.cookies.section);
    }
  );

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
