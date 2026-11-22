---
title: "A setup run signs in to each platform in a tab of its own, so a platform's page can never take Peal away"
author: Maxime
date: 2026-11-22
branch: feat/home-setup-card
cost: { minutes: 1, tokens: 1955 }
id: l-b6c049d6
scope: repo
status: active
replaces: l-94cac126
src: agent
touches:
  - packages/peal-web/src/channels/connect-run.ts
---

## Decided
- A new workspace's second step ("Set up your channels") runs the ticked platforms' normal OAuth sign-ins one after the other in a separate tab, opened by Connect or Continue; the step stays open in the first tab and follows each outcome live. Peal never reads the browser's other sessions.
- The run lives in localStorage so both tabs see it (storage events); the sign-in tab closes at the end, or loads the step afresh where the browser refuses close().

## Tried and ruled out
- Chaining sign-ins in the step's own tab: sandbox dogfood stranded members on platform pages with no way back: Google's "Back to safety" (help article, unverified app), Meta's "Something went wrong" (Instagram Unified login), mastodon.social's settings page for an account awaiting approval, and login pages of platforms the browser isn't signed in to.
- Reading cookies or detecting signed-in accounts: impossible legitimately, and against platform terms.

## Watch out
- A tab opened by window.open starts with a copy of its opener's sessionStorage: a leftover "connection under way" there finished the sign-in for the wrong workspace (invalidState). Forget it before opening the tab.
- In WebKit, a tab that called window.close() and was refused can answer null for localStorage and sessionStorage until it loads a new page: treat null storage as none and reload the step with location.replace, never a client-side navigation.
- Skipping a platform in the step while its sign-in stays open in the other tab is possible by design, so the callback finds the run's workspace from any step of the run, and a skipped step that connects anyway reads connected.

In the code:
- packages/peal-web/src/channels/connect-run.ts, use-run-step.ts (openSignInTab, leaveSignInTab), components/channels/complete-connection.tsx, account-picker.tsx, components/setup/, (setup)/create/[workspaceId]/channels
