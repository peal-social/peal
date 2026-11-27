import type { Locale } from "./i18n/locales.ts";
import type { Messages } from "./i18n/messages.ts";
import type { LegalDocument } from "./legal.ts";

// What the page listing every legal document (/legal) holds: the three
// documents most people look for first, each in a cell of its own, then
// the others in groups; and the lines under a document's title. The
// contract's functions (cancel, withdraw) are not here: contracts are made
// in the app, and its billing page holds them.

type LegalCopy = Messages["legalPage"];

/** The documents the legal page opens on. */
export const featuredDocuments = [
  "privacy",
  "terms",
  "dpa",
] as const satisfies readonly LegalDocument[];

/** The legal page's groups, under its featured documents. */
export const legalGroups: readonly {
  readonly documents: readonly LegalDocument[];
  readonly name: keyof LegalCopy["groups"];
}[] = [
  { documents: ["subprocessors", "data-deletion"], name: "data" },
  { documents: ["legal-notice"], name: "company" },
];

export interface LegalLink {
  readonly description: string;
  readonly href: string;
  readonly title: string;
}

/** A document's title and one-line description, from its front matter. */
export type DocumentSummary = (document: LegalDocument) => {
  readonly description: string;
  readonly title: string;
};

/** What the legal page shows: its featured documents, then its groups. */
export const legalIndex = (
  t: LegalCopy,
  // A document's address in the page's language.
  href: (document: LegalDocument) => string,
  summary: DocumentSummary
) => {
  const link = (document: LegalDocument): LegalLink => ({
    ...summary(document),
    href: href(document),
  });

  return {
    featured: featuredDocuments.map((document) => link(document)),
    groups: legalGroups.map(({ documents, name }) => ({
      label: t.groups[name],
      links: documents.map((document) => link(document)),
    })),
  };
};

/** The lines under a document's title: when it took effect, when it changed. */
export const legalDates = (
  t: LegalCopy,
  locale: Locale,
  dates: {
    readonly effective?: Date | undefined;
    readonly updated?: Date | undefined;
  }
): readonly string[] => {
  const format = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  });

  // French sets a space before a colon.
  const colon = locale === "fr" ? " :" : ":";

  return [
    ...(dates.effective === undefined
      ? []
      : [`${t.effective}${colon} ${format.format(dates.effective)}`]),
    ...(dates.updated === undefined
      ? []
      : [`${t.updated}${colon} ${format.format(dates.updated)}`]),
  ];
};
