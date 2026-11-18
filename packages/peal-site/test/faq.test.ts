// The home page's FAQ answers from the contract and the rate card, and its
// JSON-LD says what the page shows, in each language.
import { freeAccountsOf, rateCard } from "peal-contract/rate-card";
import { siteEntries } from "peal-ui/lib/site/platforms";
import { describe, expect, it } from "vitest";

import { faqGroups, faqJsonLd } from "../src/faq.ts";
import { locales } from "../src/i18n/locales.ts";

describe("the FAQ", () => {
  it.each(locales)("fills every placeholder in %s", (locale) => {
    for (const group of faqGroups(locale)) {
      for (const { answer, question } of group.questions) {
        expect(`${question} ${answer}`).not.toMatch(/\{[a-z]+\}/u);
      }
    }
  });

  it.each(locales)("names every platform and ad network in %s", (locale) => {
    const answers = faqGroups(locale)
      .flatMap((group) => group.questions.map((item) => item.answer))
      .join(" ");

    for (const entry of siteEntries) {
      expect(answers).toContain(entry.name);
    }
  });

  it.each(locales)("gives the rate card's free accounts in %s", (locale) => {
    const answers = faqGroups(locale)
      .flatMap((group) => group.questions.map((item) => item.answer))
      .join(" ");

    expect(answers).toContain(`${freeAccountsOf(rateCard)} `);
  });

  it.each(locales)("lists every question in the JSON-LD in %s", (locale) => {
    const groups = faqGroups(locale);
    const document = faqJsonLd(groups);

    expect(document["@type"]).toBe("FAQPage");
    expect(document.mainEntity).toHaveLength(
      groups.reduce((count, group) => count + group.questions.length, 0)
    );
    expect(document.mainEntity[0]?.acceptedAnswer.text).toBe(
      groups[0]?.questions[0]?.answer
    );
  });
});
