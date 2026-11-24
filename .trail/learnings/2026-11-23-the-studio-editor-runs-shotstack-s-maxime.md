---
title: "The Studio editor runs Shotstack's Studio SDK as its engine only, under Peal's own ui-sdk controls, and renders on the workspace's Shotstack account"
author: Maxime
date: 2026-11-23
branch: feat/studio-sdk
cost: { minutes: 22, tokens: 288021 }
id: l-a8b057e8
scope: repo
status: active
src: agent
touches:
  - DESIGN.md
  - packages/peal-docs/docs/fr/guides/media/index.mdx
  - packages/peal-docs/docs/guides/media/index.mdx
  - packages/peal-web/AGENTS.md
  - packages/peal-web/messages/en.json
  - packages/peal-web/messages/fr.json
  - "packages/peal-web/src/app/[locale]/(app)/[workspaceId]/editor/page.tsx"
  - packages/peal-web/src/components/shell/sidebar-view.tsx
  - packages/peal-web/src/components/studio/editor-screen.tsx
---

## Decided
- The owner wants Shotstack's Studio SDK behaviours in PealCreative's Studio › Editor, drawn in Peal's look. The SDK's `Edit` (document, mutations, undo/redo, playback, events) and `Canvas` (preview) are the engine. Their `Timeline`, `UIController` and `Controls` are never loaded: the controls are ui-sdk (Toolbar, Slider, Listbox) with peal-ui tokens.
- Rendering stays on Shotstack's cloud, with the workspace's own key, through the slide-video job: the server takes the whole Shotstack Edit, checks it with Shotstack's MIT schema, swaps `peal:media/<id>` names for hour-long links, and forces the output (mp4, no hosted copy, no callback).
- Drafts are kept in the browser per workspace, with files by `peal:media/<id>`, never by address: library addresses last an hour.

## Tried and ruled out
- The SDK's browser exporter (`VideoExporter`): its licence (PolyForm Shield 1.0.0) forbids competing with Shotstack's products, rendering without their cloud would be one, and the browser draws some features differently.
- Modelling Shotstack's Edit schema as an Effect contract: too large and it would lag every SDK release; the endpoint takes the Edit as JSON and the server validates it.
- The package's `./internal` entry: marked for Shotstack's own products only.

## Watch out
- From the visitor's browser the SDK fetches from fonts.gstatic.com, js.shotstack.io (HarfBuzz WebAssembly, fonts), templates.shotstack.io (fonts), unpkg.com (resvg WebAssembly) and cdn.jsdelivr.net (emoji). Those go through Peal's own origin, so visitors' addresses never reach those hosts.
- Selecting a clip from the host uses `Edit.selectClip` and `clearSelection`, present at runtime but missing from the published types: called only when present, with the version pinned.
- Clearing a clip field: the SDK applies updates with Object.assign, so a field set to undefined drops from the saved document.
- The web image bundles the SDK: its licence terms and "Required Notice: Copyright Shotstack Pty Ltd" must ship with it.

In the code: packages/peal-web/src/components/studio/studio-engine.ts, src/studio/edit-document.ts, src/studio/draft.ts, @shotstack/shotstack-studio 2.33.1 and @shotstack/schemas 1.27.0 pinned, POST /api/workspaces/{id}/media/slideshows/edits.
