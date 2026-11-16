import { freeAccountsOf, rateCard } from "peal-contract/rate-card";
import type { FaqGroup } from "peal-ui/components/faq-section";

import type { Locale } from "./i18n/locales.ts";
import { messages } from "./i18n/messages.ts";
import { siteEntries } from "./platforms.ts";
import type { PlatformGroup } from "./platforms.ts";

// The home page's FAQ: its strings, with the figures and lists that come
// from the contract (the platforms) and the rate card (the free accounts)
// filled in, so no answer types one.

const namesIn = (locale: Locale, group: PlatformGroup) =>
  new Intl.ListFormat(locale, { type: "conjunction" }).format(
    siteEntries
      .filter((entry) => entry.group === group)
      .map((entry) => entry.name)
  );

const fill = (text: string, values: Readonly<Record<string, string>>) =>
  text.replaceAll(
    /\{(?<name>[a-z]+)\}/gu,
    (match, name: string) => values[name] ?? match
  );

/** The FAQ's groups in a language, every placeholder filled. */
export const faqGroups = (locale: Locale): FaqGroup[] => {
  const values = {
    blog: namesIn(locale, "blog"),
    chat: namesIn(locale, "chat"),
    free: new Intl.NumberFormat(locale).format(freeAccountsOf(rateCard)),
    social: namesIn(locale, "social"),
  };

  return messages(locale).home.faq.groups.map((group) => ({
    questions: group.questions.map(({ answer, question }) => ({
      answer: fill(answer, values),
      question,
    })),
    title: group.title,
  }));
};

/** The questions as schema.org's FAQPage, for the page's head. */
export const faqJsonLd = (groups: readonly FaqGroup[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: groups.flatMap((group) =>
    group.questions.map(({ answer, question }) => ({
      "@type": "Question",
      acceptedAnswer: { "@type": "Answer", text: answer },
      name: question,
    }))
  ),
});

/** The JSON-LD as a script's text, safe inside HTML. */
export const faqJsonLdText = (groups: readonly FaqGroup[]) =>
  JSON.stringify(faqJsonLd(groups)).replaceAll("<", String.raw`<`);
