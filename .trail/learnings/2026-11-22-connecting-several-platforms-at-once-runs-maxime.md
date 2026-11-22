---
title: "Connecting several platforms at once runs their normal sign-ins one after the other in the same tab, never reading the browser's other sessions"
author: Maxime
date: 2026-11-22
branch: feat/home-setup-card
cost: { minutes: 85, tokens: 580807 }
id: l-94cac126
scope: repo
status: active
src: agent
touches:
  - DESIGN.md
  - packages/peal-docker/compose.production.yaml
  - packages/peal-docker/self-host.env.example
  - packages/peal-docs/docs/fr/guides/channels/index.mdx
  - packages/peal-docs/docs/fr/self-hosting/environment-variables.mdx
  - packages/peal-docs/docs/guides/channels/index.mdx
  - packages/peal-docs/docs/self-hosting/environment-variables.mdx
  - packages/peal-e2e/AGENTS.md
  - packages/peal-e2e/tests/setup-card.e2e.ts
  - packages/peal-web/AGENTS.md
---

## Decided
- "Connect all my accounts in one click" is a setup card on a new workspace's Home: the member ticks platforms (nothing pre-ticked, as no page can know where the browser is signed in), and the tab runs each platform's ordinary OAuth sign-in in turn. Where the member is already signed in, a sign-in is one consent click; one click on Peal starts the run.
- Full-page redirects, not popups: a browser opens one popup per click, so popups would cost a Peal click per platform. The callback page starts the next sign-in itself; Home never leaves for a platform on its own, so Back cannot trap the member.
- Web app only: the run lives in the tab's session storage; the server checks each connection like any other. Platforms whose app is still under review are kept off the card by a setting, as a member outside the testers would stop on the platform's page.

## Tried and ruled out
- Reading the browser's sessions on the platforms (a browser extension reading cookies): session hijacking, against Meta's Platform Terms and every app review. Detecting where the browser is signed in: no legitimate way exists.
- One grant covering several platforms (Meta's Pages and Instagram together): an attempt and its callback are bound to one platform; left for later.

## Watch out
- Sandbox dogfood (2026-11-22): the browser's session may be the wrong account (X offered the owner's personal and brand accounts, not the sandbox one), and a platform the browser isn't signed in to is a full login. The card cannot tell which account a platform will use.
- Back from a platform's page walks back through the earlier platforms' consent pages, not to Home: each is a history entry. Opening Home shows the run where it stopped.
- The success chain can't run in e2e (no platform is reachable); it is covered by unit tests and was dogfooded with mocked API answers, then on the sandbox.

In the code:
- packages/peal-web/src/channels/connect-run.ts (the run), use-run-step.ts (starts a step), components/channels/complete-connection.tsx and account-picker.tsx (record and go on), components/home/setup-card*.tsx, src/home/setup.ts
- PEAL_SETUP_HIDDEN_PLATFORMS (web app, comma-separated platform names)
- DESIGN.md, Pages, Home: the setup card's three states
