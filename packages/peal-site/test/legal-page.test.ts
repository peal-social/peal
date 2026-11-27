import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { locales } from "../src/i18n/locales.ts";
import { messages } from "../src/i18n/messages.ts";
import { legalDates, legalIndex } from "../src/legal-page.ts";
import { legalDocuments } from "../src/legal.ts";
import type { LegalDocument } from "../src/legal.ts";

const summary = (name: LegalDocument) => ({
  description: `About ${name}.`,
  title: name,
});

const documentHref = (name: LegalDocument) => `/${name}/`;

describe("the legal page", () => {
  const { featured, groups } = legalIndex(
    messages("en").legalPage,
    documentHref,
    summary
  );

  it("lists every document once", () => {
    expect(
      [...featured, ...groups.flatMap(({ links }) => links)]
        .map(({ href }) => href)
        .toSorted()
    ).toStrictEqual(
      legalDocuments.map((name) => documentHref(name)).toSorted()
    );
  });

  it("opens on the privacy policy, the terms and the data processing agreement", () => {
    expect(featured.map(({ href }) => href)).toStrictEqual([
      "/privacy/",
      "/terms/",
      "/dpa/",
    ]);
  });
});

describe("the legal documents", () => {
  it.each(locales)("each have a version in %s", (locale) => {
    const files = readdirSync(
      path.join(import.meta.dirname, "../src/content/legal", locale)
    );

    expect(files.toSorted()).toStrictEqual(
      legalDocuments.map((name) => `${name}.md`).toSorted()
    );
  });

  it("show when they took effect and when they last changed", () => {
    const dates = {
      effective: new Date("2026-11-13"),
      updated: new Date("2026-11-25"),
    };

    expect(legalDates(messages("en").legalPage, "en", dates)).toStrictEqual([
      "Effective date: 13 November 2026",
      "Last updated: 25 November 2026",
    ]);
    expect(legalDates(messages("fr").legalPage, "fr", dates)).toStrictEqual([
      "Date d’entrée en vigueur : 13 novembre 2026",
      "Dernière mise à jour : 25 novembre 2026",
    ]);
    expect(legalDates(messages("en").legalPage, "en", {})).toStrictEqual([]);
  });
});
