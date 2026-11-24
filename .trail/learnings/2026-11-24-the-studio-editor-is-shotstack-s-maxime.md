---
title: "The Studio editor is Shotstack's own Studio interface restyled in CSS alone, and renders on the workspace's Shotstack account"
author: Maxime
date: 2026-11-24
branch: feat/studio-sdk-ui
cost: { minutes: 29, tokens: 416181 }
id: l-3690c61b
scope: repo
status: active
replaces: l-a8b057e8
src: agent
touches:
  - DESIGN.md
  - packages/peal-docs/docs/fr/guides/media/index.mdx
  - packages/peal-docs/docs/guides/media/index.mdx
  - packages/peal-web/AGENTS.md
  - packages/peal-web/messages/en.json
  - packages/peal-web/messages/fr.json
  - packages/peal-web/src/app/globals.css
  - packages/peal-web/src/components/studio/editor-screen.tsx
  - packages/peal-web/src/components/studio/studio-editor.tsx
  - packages/peal-web/src/components/studio/studio-engine.ts
---

## Decided
- The owner reversed the earlier choice on 2026-11-24: controls of Peal's own over the SDK were over-engineered, and more to remove if Shotstack is dropped. The SDK's preview, timeline, toolbars and keys are used whole; Peal changes only their look, in CSS.
- Still true: rendering stays on Shotstack's cloud with the workspace's own key, through the slide-video job, which takes the whole Edit and checks it. Drafts stay in the browser per workspace, with files by library name, as addresses last an hour.

## Tried and ruled out
- Rebuilding the timeline, inspector and toolbars on ui-sdk (merged), then shapes, keyframes and captions the same way (PR 476, closed unmerged): about 3,700 lines to keep up with each SDK release.
- The SDK's browser exporter: its licence (PolyForm Shield 1.0.0) forbids competing with Shotstack's products, rendering without their cloud could be one, and the browser draws some features differently.
- Modelling Shotstack's Edit as an Effect contract: too large, and it would lag each release.
- The package's internal entry: marked for Shotstack's own products.

## Watch out
- The SDK's size menu writes output.size, which the server refuses: it is stored as an aspect and a resolution, and the sizes and 60 fps the server does not render are hidden in CSS.
- The SDK refuses an edit with an empty track, so a new video starts with a text.
- The SDK appends its stylesheet when it starts, so overrides need a more specific selector. Its floating toolbars hard-code white text, so they stay dark.
- Its words are English only.
- The SDK fetches fonts, WebAssembly and emoji from other hosts: all go through Peal's origin. Its licence notice must ship with the bundle.

In the code: packages/peal-web/src/components/studio/ (studio.css, studio-engine.ts, studio-editor.tsx), src/studio/edit-document.ts (storedOf), src/studio/asset-relay.ts, @shotstack/shotstack-studio 2.33.1.
