---
title: "Legal pages pair each section with plain lines, and their section headings must keep their names"
author: Maxime
date: 2026-11-23
branch: worktree-golden-forging-lampson
cost: { minutes: 21, tokens: 247120 }
id: l-f70f4e53
scope: repo
status: active
src: agent
touches:
  - packages/peal-site/src/content/legal/en/dpa.md
  - packages/peal-site/src/content/legal/en/terms.md
  - packages/peal-site/src/content/legal/en/privacy.md
  - packages/peal-site/src/legal.ts
  - "packages/peal-site/src/pages/[...locale]/[document].astro"
  - packages/peal-site/test/privacy-retention.test.ts
  - packages/peal-ui/test/site-navigation.test.ts
---

## Decided

- Each legal page of the site opens with a short summary that says it is not binding, and each section ends with a few plain lines ("What it means", "En clair" in French). The legal text itself stays as it was reviewed; the plain lines only restate it.
- The list of providers has its own page, and the privacy policy keeps the categories and links to it. The data processing agreement is part of the terms and needs no signature.
- A new legal document starts as a draft until legal review; a page that only moves text already published does not.

## Tried and ruled out

- Numbering the section headings: a heading's text is its anchor, and other code links to those anchors, so a renamed heading breaks links without any build error.
- Rewriting the existing legal sentences for style: the risk of dropping a legal fact is higher than the gain. Only the new text is written freely.
- Labelling the plain lines from CSS: generated content is not reliably read aloud or copied, so the label is in the Markdown.

## Watch out

- The retention table of the privacy policy is compared cell by cell with the contract's registry, in both languages. Change the registry first. The test takes every table line of that section, so put no other table there.
- The footer's Cookie settings link points to the cookies section's heading slug, in each language.
- English and French files are parallel: apply a structural change to both, and link French pages with the /fr/ prefix.
- Bracketed placeholders are never filled from a guess: only from what the owner confirmed.

In the code:

- packages/peal-site/src/content/legal/<locale>/<document>.md; a plain block is `<aside>`, a blank line, `**What it means**`, the text, a blank line, `</aside>`.
- packages/peal-site/src/legal.ts lists the documents that get a page.
- packages/peal-site/src/pages/[...locale]/[document].astro styles the asides.
- packages/peal-site/test/privacy-retention.test.ts and packages/peal-ui/test/site-navigation.test.ts hold the checks named above.
