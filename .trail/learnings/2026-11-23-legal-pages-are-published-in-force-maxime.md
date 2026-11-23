---
title: "Legal pages are published in force, with numbered sections whose headings keep their names"
author: Maxime
date: 2026-11-23
branch: docs/legal-layout
cost: { minutes: 70, tokens: 212170 }
id: l-ceb053ee
scope: repo
status: active
replaces: l-f70f4e53
src: agent
touches:
  - AGENTS.md
  - packages/peal-site/src/content/legal/en/dpa.md
  - packages/peal-site/src/content/legal/en/privacy.md
  - packages/peal-site/src/content/legal/en/terms.md
  - packages/peal-site/src/content/legal/fr/dpa.md
  - packages/peal-site/src/content/legal/fr/privacy.md
  - packages/peal-site/src/content/legal/fr/terms.md
  - packages/peal-site/src/i18n/messages.ts
  - packages/peal-site/src/legal-sections.ts
  - "packages/peal-site/src/pages/[...locale]/[document].astro"
---

## Decided

- Legal pages go out in force: no draft banner, no note to counsel in the page. A sentence whose fact does not exist yet (a VAT number, a mediator) is left out until it does.
- Each page opens with a summary that is not binding, and each section ends with plain lines, shown beside the legal text on a wide screen.
- Sections are numbered by the stylesheet. The headings' own text does not change.

## Tried and ruled out

- Numbers written into the headings: a heading's text is its anchor, and other code links to those anchors.
- A plugin on the Markdown pipeline to group sections: the site's Markdown processor takes none without another package, so the page cuts the rendered HTML at each section instead.
- Rewording the legal sentences for readability: long paragraphs become one bullet a sentence, the words unchanged.

## Watch out

- The privacy policy's retention table is compared cell by cell with the contract's registry, in both languages, and the test takes every table line of that section.
- The footer's Cookie settings link points to the cookies heading's slug, in each language.
- English and French files are parallel: change both, and link French pages with the /fr/ prefix.

In the code:

- packages/peal-site/src/content/legal/<locale>/<document>.md; plain lines are an `<aside>` that closes a `##` section.
- packages/peal-site/src/legal-sections.ts cuts the page; src/styles/legal.css numbers and lays it out.
- packages/peal-site/test/privacy-retention.test.ts, test/legal-sections.test.ts, packages/peal-ui/test/site-navigation.test.ts.
