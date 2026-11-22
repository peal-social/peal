---
title: "Crisp's chat is themed and opened by Peal's own launcher, and Crisp's quirks shape the glue"
author: Maxime
date: 2026-11-22
branch: feat/support-chat
cost: { minutes: 8, tokens: 66865 }
id: l-75af7ee5
scope: repo
status: active
src: agent
touches:
  - packages/peal-ui/src/lib/support/events.ts
  - packages/peal-ui/src/lib/support/element.ts
  - packages/peal-ui/src/lib/support/settings.ts
  - packages/peal-ui/src/styles/support.css
  - packages/peal-web/src/components/shell/support-launcher.tsx
  - DESIGN.md
  - packages/peal-web/AGENTS.md
  - packages/peal-contract/src/data-processing.ts
---

## Decided
- Peal opens Crisp itself (peal-ui `<peal-support>`, `packages/peal-ui/src/lib/support/element.ts`): a pixel speech bubble on the marketing site and the blog, a lucide message-circle in the docs, and in the web app the account menu's Support (`openSupportChat`), no launcher (the owner's choices). Crisp's round button is hidden by CSS; its script loads only on a press or when its conversation cookie exists, so no consent is asked. Escape or a press outside closes the window, as Crisp's has no close on a computer.
- Crisp offers only preset colours and no position offset: Peal's blue, Geist and the window's place come from `packages/peal-ui/src/styles/support.css` over the variables Crisp sets inline on `.crisp-client` (`--crisp-color-theme-*`, overridden with !important) and its data attributes, never its hashed `cc-…` classes.
- Support conversations are kept 3 years after their last message (CNIL's period for customer and prospect contacts, `supportConversations` in `packages/peal-contract/src/data-processing.ts`); Crisp cannot delete by itself, so staff do. MagicType is off in Crisp's settings, as the privacy policy covers sent messages only.

## Tried and ruled out
- Calling `chat:show` + `chat:open` alone: Crisp brings back a chat left open on an earlier page, and `chat:opened` never fires for it. `crisp.ts` closes any chat the launcher did not ask for (`closeUnasked`) and tells "opened" itself when it was already open.
- Creating Crisp accounts from Lilo's isolated tab: Crisp answered "forbidden from creating a Crisp account" after the CAPTCHA; an operator accepts the invite from their own browser.

## Watch out
- `$crisp.push(["on", event, cb])` keeps one callback per event: registering another (even in a debug console) replaces the launcher's.
- Crisp rejects an email on a non-public domain (`peal.test`), showing "You mistyped your email".
