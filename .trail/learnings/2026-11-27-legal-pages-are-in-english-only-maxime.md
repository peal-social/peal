---
title: "Legal pages are in English only, laid out like a legal hub with one column per document, and name the consumer mediator"
author: Maxime
date: 2026-11-27
branch: worktree-splendid-yawning-horizon
cost: { minutes: 17, tokens: 321296 }
id: l-26fdf43d
scope: repo
status: active
replaces: l-ceb053ee
src: agent
touches:
  - packages/peal-site/src/legal.ts
  - packages/peal-ui/src/lib/site/navigation.ts
  - packages/peal-ui/test/site-navigation.test.ts
  - packages/peal-site/src/legal-page.ts
  - "packages/peal-site/src/pages/[document].astro"
  - packages/peal-site/src/pages/legal.astro
  - packages/peal-site/src/styles/legal.css
  - packages/peal-site/src/content/legal/legal-notice.md
  - packages/peal-site/test/privacy-retention.test.ts
  - packages/peal-site/test/legal-page.test.ts
---

## Decided

- The owner asked on 2026-11-27 for the legal pages in English only, with no French version. The French files are gone; every link to a legal page, from any language, the blog's and the docs' consent notices included, names the English page, and the old /fr/<document> addresses redirect to it.
- The owner asked for the layout of a well-known product tool's legal hub: /legal lists every document, the privacy policy, the terms and the data processing agreement in three cells, then groups (personal data, company, source code licences). A document is one centred column: big title, dates in mono, numbered contents, ruled sections with their numbers hanging in the margin.
- The plain-language lines stay, under each section's text rather than beside it, and the summary stays at the top.
- Dates live in the front matter (`effective`, `updated`), not in the body.
- French consumer law needs the mediator on the site and in the terms: SAS Médiation Solution, membership MS/26/F10D6096, convention signed 2026-11-25. The terms' disputes section and the new legal notice name it, in the mediator's own model wording.
- Legal pages go out in force (no draft banner, no note to counsel); a fact that does not exist yet is left out, not guessed. The legal notice leaves out the share capital, a phone number and the VAT number for that reason.

## Tried and ruled out

- Numbers written into the headings: a heading's text is its anchor, and other code links to those anchors.
- Keeping the plain lines beside the text: it breaks the single column the owner asked for.

## Watch out

- The privacy policy's retention table is compared cell by cell with the contract's registry (English rows only now).
- The footer's Cookie settings link points to the English cookies heading's slug in every language.
- The mediator's convention and invoice hold the bank details and fees: never copy them into the repository.

In the code:

- packages/peal-site/src/content/legal/<document>.md; src/legal.ts (documents, redirects), src/legal-page.ts (hub and English words), src/pages/legal.astro, src/pages/[document].astro, src/styles/legal.css.
- packages/peal-ui/src/lib/site/navigation.ts (FooterDocument), packages/peal-blog/src/chrome.ts, packages/peal-docs/components/measurement.ts.
- DESIGN.md, Site, "Legal pages".
