// The history in Markdown: a release's notes for GitHub, and the docs'
// Changelog page in each language. The page's headings, dates and words are
// the language's; the entries stay in English until entryText translates
// them, the one place a translation plugs in.
import { sections } from "./entries.ts";
import type { Entry, Section } from "./entries.ts";
import type { History, Release } from "./history.ts";

export const locales = ["en", "fr"] as const;

export type Locale = (typeof locales)[number];

interface Words {
  readonly sections: Readonly<Record<Section, string>>;
  readonly breaking: string;
  readonly empty: string;
  readonly none: string;
  readonly released: (day: string) => string;
  readonly dateLocale: string;
}

const words: Readonly<Record<Locale, Words>> = {
  en: {
    breaking: "Breaking change:",
    dateLocale: "en-GB",
    empty: "Maintenance only: nothing in this release changes how Peal works.",
    none: "Nothing has been released yet.",
    released: (day) => `Released on ${day}.`,
    sections: {
      features: "Features",
      fixes: "Fixes",
      performance: "Performance",
      security: "Security",
    },
  },
  fr: {
    breaking: "Changement incompatible :",
    dateLocale: "fr-FR",
    empty:
      "Maintenance uniquement : rien dans cette version ne change le fonctionnement de Peal.",
    none: "Aucune version n’a encore été publiée.",
    released: (day) => `Publiée le ${day}.`,
    sections: {
      features: "Nouveautés",
      fixes: "Corrections",
      performance: "Performances",
      security: "Sécurité",
    },
  },
};

/**
 * An entry's text in a language. Entries are written in English, in the
 * pull request's title; a translation, once there is one, is returned here.
 */
export const entryText = (entry: Entry, _locale: Locale): string =>
  entry.description;

// Markdown and MDX would read these as markup: `{` opens an expression and
// `<` a component in MDX, the others emphasis, links or tables. Code spans
// stay as written.
const markup = /[\\{}<>*_[\]~|]/gu;

const codeSpan = /(?<ticks>`+)[^`][\s\S]*?\k<ticks>/gu;

/** Text as Markdown and MDX show it, code spans kept. */
export const escapeMarkdown = (text: string): string => {
  let escaped = "";
  let from = 0;

  for (const span of text.matchAll(codeSpan)) {
    escaped += text.slice(from, span.index).replaceAll(markup, "\\$&");
    escaped += span[0];
    from = span.index + span[0].length;
  }

  return escaped + text.slice(from).replaceAll(markup, "\\$&");
};

const capitalised = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const line = (entry: Entry, locale: Locale, repository: string): string => {
  const text = escapeMarkdown(capitalised(entryText(entry, locale)));
  const prefix = entry.breaking ? `${words[locale].breaking} ` : "";

  return `- ${prefix}${text} ([#${entry.pull}](https://github.com/${repository}/pull/${entry.pull}))`;
};

/** The release's sections, each a heading and its list, in order. */
const sectionsOf = (
  release: Release,
  locale: Locale,
  repository: string,
  heading: (section: Section) => string
): readonly string[] =>
  sections.flatMap((section) => {
    const entries = release.entries.filter(
      (entry) => entry.section === section
    );

    return entries.length === 0
      ? []
      : [
          heading(section),
          entries.map((entry) => line(entry, locale, repository)).join("\n"),
        ];
  });

/** The notes of a GitHub release: its sections, in English. */
export const releaseNotes = (release: Release, repository: string): string => {
  const parts = sectionsOf(
    release,
    "en",
    repository,
    (section) => `## ${words.en.sections[section]}`
  );

  return `${(parts.length === 0 ? [words.en.empty] : parts).join("\n\n")}\n`;
};

const dayOf = (date: string, locale: Locale): string =>
  new Intl.DateTimeFormat(words[locale].dateLocale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

// `v2026.11.16.2` is `#v2026-11-16-2`, in both languages.
const anchorOf = (tag: string): string => tag.replaceAll(".", "-");

const pageSection = (
  release: Release,
  locale: Locale,
  repository: string
): string => {
  const anchor = anchorOf(release.tag);

  const parts = sectionsOf(
    release,
    locale,
    repository,
    (section) =>
      `### ${words[locale].sections[section]} [#${anchor}-${section}]`
  );

  return [
    `## ${release.tag} [#${anchor}]`,
    words[locale].released(dayOf(release.date, locale)),
    ...(parts.length === 0 ? [words[locale].empty] : parts),
  ].join("\n\n");
};

/** The Changelog page's releases in a language, newest first. */
export const changelogPage = (history: History, locale: Locale): string =>
  history.releases.length === 0
    ? words[locale].none
    : history.releases
        .map((release) => pageSection(release, locale, history.repository))
        .join("\n\n");
