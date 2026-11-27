---
title: "The contract's cancel and withdraw functions live on the app's billing page only, not on the marketing site"
author: Maxime
date: 2026-11-27
branch: feat/legal-hub
cost: { minutes: 33, tokens: 248028 }
id: l-bedbbe4e
scope: repo
status: active
src: agent
touches:
  - AGENTS.md
  - DESIGN.md
  - packages/peal-blog/test/chrome.test.ts
  - packages/peal-site/src/content.config.ts
  - packages/peal-site/src/content/legal/en/dpa.md
  - packages/peal-site/src/content/legal/en/legal-notice.md
  - packages/peal-site/src/content/legal/en/privacy.md
  - packages/peal-site/src/content/legal/en/subprocessors.md
  - packages/peal-site/src/content/legal/en/terms.md
  - packages/peal-site/src/content/legal/fr/dpa.md
---

## Decided

- The owner decided (2026-11-27) that "Cancel your contract" and "Withdraw from contract here" are not on the marketing site, neither in its footer nor on /legal. Peal bills only through the web app, and the law asks for both functions on the interface where the contract is concluded: French Consumer Code D. 215-1 ("directement et facilement accessible à partir de l'interface en ligne depuis laquelle le consommateur peut conclure des contrats") and Article 11a of Directive 2011/83, as amended by 2023/2673. The decree also lets a business ask an existing customer to use their account, and every Peal customer has one.
- The billing page holds both, under the law's labels. The app's public /cancel and /withdraw forms stay, linked from nowhere.
- Every text that said "at the foot of every page of the website" now says the billing page: the terms, the pricing page, the billing and self-hosting docs, the contract emails and the app's billing strings, in both languages.
- The footer's Company column is Pricing, Legal, Cookie settings, with no Policies menu.

## Tried and ruled out

- Keeping the links in the footer's bottom row, or in a "Your contract" group on /legal: the owner wants none of it on the site, as nothing is sold there.

## Watch out

- The functions themselves remain mandatory, for pay-as-you-go too: a consumer contract concluded online must offer them. Don't remove the billing page's buttons.
- French docs need no-break spaces before : ; » and after «; `bun scripts/french-typography.ts` in packages/peal-docs sets them.

In the code:

- packages/peal-ui/src/lib/site/navigation.ts (company column), packages/peal-ui/src/components/site-footer.tsx (no column menu; policy-menu.tsx deleted).
- packages/peal-emails/src/catalog/{english,french}.ts, packages/peal-web/messages/{en,fr}.json (withdrawable, startNow), packages/peal-docs/docs/**/billing.mdx and self-hosting/options.mdx.
