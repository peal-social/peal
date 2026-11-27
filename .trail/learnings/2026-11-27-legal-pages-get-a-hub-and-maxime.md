---
title: "Legal pages get a hub and one column per document, in both languages, and name the consumer mediator"
author: Maxime
date: 2026-11-27
branch: worktree-splendid-yawning-horizon
cost: { minutes: 8, tokens: 92475 }
id: l-122370d1
scope: repo
status: active
replaces: l-26fdf43d
src: agent
touches:
  - packages/peal-site/src/content/legal/fr/legal-notice.md
  - packages/peal-site/src/legal-page.ts
  - packages/peal-site/src/legal.ts
  - "packages/peal-site/src/pages/[...locale]/legal.astro"
  - "packages/peal-site/src/pages/[...locale]/[document].astro"
  - packages/peal-site/test/legal-page.test.ts
  - packages/peal-ui/src/lib/site/navigation.ts
  - DESIGN.md
  - packages/peal-site/src/styles/legal.css
---

## Decided
- The owner asked (2026-11-27) for the layout of a well-known product tool's legal hub. /legal lists every document: the privacy policy, terms and data processing agreement in three cells, then groups (personal data, company). There is no source code group; the owner said it is not needed there. A document is one centred column: big title, dates in mono, the summary card, numbered contents, then ruled sections with their numbers hanging in the margin. Plain-language lines sit under each section's text.
- English and French both stay. The owner first asked for English only, then reversed once told that French law (Loi Toubon) wants French for consumer contracts. The French text follows the English sentence for sentence, with French legal equivalents.
- Dates live in the front matter (`effective`, `updated`), formatted per locale.
- French consumer law needs the mediator on the site and in the terms: SAS Médiation Solution, membership MS/26/F10D6096. The terms' disputes section and the legal notice name it, in the mediator's model wording.
- The legal notice gives the share capital (€1,000). The phone number and VAT number are left out until they exist, not guessed.
- The owner wants the sub-processors list as a table (provider, service, location, transfer safeguard). Where a provider does several things, its Service cell is a short lead ("Hosting:") followed by a bullet list (server, database, logs). A provider with one service keeps a one-line cell.
- Both languages follow the same structure.

## Tried and ruled out
- English-only legal pages: tried and reverted the same day, for the Loi Toubon.
- Numbers written into the headings: a heading's text is its anchor, and other code links to those anchors.
- Replacing the table with one sub-section per service and labelled bullets ("Provider:", "Location:"): the owner found the table fine and only wanted the services split into bullets.

## Watch out
- The privacy policy's retention table is compared cell by cell with the contract's registry, in both languages.
- The mediator's convention and invoice hold bank details and fees: never copy them into the repository.

In the code:

- packages/peal-site/src/content/legal/<locale>/<document>.md; src/legal.ts, src/legal-page.ts, src/pages/[...locale]/legal.astro and [document].astro, src/styles/legal.css; strings in src/i18n/messages.ts (legalPage).
- packages/peal-ui/src/lib/site/navigation.ts (FooterDocument); DESIGN.md, Site, "Legal pages".
- Markdown tables can't hold lists, so a cell's list is inline HTML (`<ul><li>…</li></ul>`) on the row's single line.


- packages/peal-site/src/content/legal/<locale>/subprocessors.md, the "Current sub-processors" table.
- packages/peal-site/src/styles/legal.css: `.legal-section td ul` and `td li` tighten the cell lists.
