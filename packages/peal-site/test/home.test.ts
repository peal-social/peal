// The home page links only to docs pages that exist in every language, and
// its mocks count their texts as the contract does.
import { existsSync } from "node:fs";
import path from "node:path";

import { measureText, platformRules } from "peal-contract/post-text";
import { describe, expect, it } from "vitest";

import { faqGroups } from "../src/faq.ts";
import { apiRows, heroTabs, studioBento } from "../src/home.ts";
import type { HomeSettings } from "../src/home.ts";
import { defaultLocale, locales } from "../src/i18n/locales.ts";
import type { Locale } from "../src/i18n/locales.ts";
import { messages } from "../src/i18n/messages.ts";

const docsRoot = path.join(import.meta.dirname, "../../peal-docs/docs");

const docsBase = "https://docs.test/";

const settings: HomeSettings = {
  app: (page) => `https://app.test/${page}`,
  docs: (page) => `${docsBase}${page}`,
  pulls: [],
  stars: undefined,
};

const pageExists = (locale: Locale, page: string) => {
  const folder =
    locale === defaultLocale ? docsRoot : path.join(docsRoot, locale);

  const [file = ""] = page.split("#");

  return (
    existsSync(path.join(folder, `${file}.mdx`)) ||
    existsSync(path.join(folder, file, "index.mdx"))
  );
};

/** Every docs page the hero, the bento and the rows link to. */
const docsPages = (locale: Locale) => {
  const t = messages(locale).home;
  const tabs = heroTabs(locale, messages(locale), settings);
  const bento = studioBento(locale, t, settings);
  const rows = apiRows(t, settings);

  return [
    ...tabs.flatMap((tab) => tab.chips.map((chip) => chip.href)),
    ...bento.cards.flatMap((card) =>
      card.link === undefined ? [] : [card.link.href]
    ),
    ...bento.tiles.flatMap((tile) =>
      tile.href === undefined ? [] : [tile.href]
    ),
    ...rows.flatMap((row) => (row.link === undefined ? [] : [row.link.href])),
  ].flatMap((href) =>
    href.startsWith(docsBase) ? [href.slice(docsBase.length)] : []
  );
};

describe("the home page", () => {
  it.each(locales)("links to docs pages that exist in %s", (locale) => {
    const pages = docsPages(locale);

    expect(pages.length).toBeGreaterThan(15);

    for (const page of pages) {
      expect(pageExists(locale, page), page).toBe(true);
    }
  });

  it.each(locales)(
    "counts each composer channel's text against its platform's limit in %s",
    (locale) => {
      const [studio] = heroTabs(locale, messages(locale), settings);

      const content = studio?.content;

      const channels =
        content?.kind === "composer" ? content.composer.channels : [];

      const number = new Intl.NumberFormat(locale);

      expect(channels.map((channel) => channel.value)).toStrictEqual([
        "bluesky",
        "mastodon",
        "linkedin",
      ]);

      for (const channel of channels) {
        const limit = Object.entries(platformRules).find(
          ([platform]) => platform === channel.value
        )?.[1].textLimits[0];

        expect(channel.count).toBe(
          `${number.format(measureText(channel.text, limit?.unit ?? "graphemes"))} / ${number.format(limit?.maximum ?? 0)}`
        );
      }
    }
  );

  it.each(locales)(
    "tells PealStudio from PealAPI in its FAQ in %s",
    (locale) => {
      const questions = faqGroups(locale).flatMap((group) => group.questions);

      expect(
        questions.some(
          ({ answer, question }) =>
            question.includes("PealStudio") &&
            question.includes("PealAPI") &&
            answer.includes("PealStudio") &&
            answer.includes("PealAPI")
        )
      ).toBe(true);
    }
  );
});
