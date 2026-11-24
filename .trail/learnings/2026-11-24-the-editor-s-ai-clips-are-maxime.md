---
title: "The editor's AI clips are sent to render without their prompt, and its shapes are SVG clips"
author: Maxime
date: 2026-11-24
branch: feat/studio-ai-video
cost: { minutes: 130, tokens: 291150 }
id: l-c13b94bb
scope: repo
status: active
src: agent
touches:
  - packages/peal-docs/docs/fr/guides/media/index.mdx
  - packages/peal-docs/docs/guides/media/index.mdx
  - packages/peal-web/messages/en.json
  - packages/peal-web/messages/fr.json
  - packages/peal-web/src/assistant/api.ts
  - packages/peal-web/src/components/studio/studio-editor.tsx
  - packages/peal-web/src/components/studio/studio-engine.ts
  - packages/peal-web/src/components/studio/studio-tools.ts
  - packages/peal-web/src/components/studio/use-studio-generator.ts
  - packages/peal-web/src/studio/edit-document.ts
---

## Decided
- A clip generated in the editor is exported by its file alone, and a clip not generated yet is refused: Shotstack regenerates any clip that still carries a prompt, on the workspace's Shotstack credits.
- Shapes are inline SVG clips, as the SDK's toolbar edits those.
- Generations wait their turn: a second call of a web mutation cuts the first off, once paid for.

## Tried and ruled out
- Shotstack's own shape asset: the SDK has no toolbar for it, and scales it to fill the frame unless the clip's fit is none.
- Linking captions by hand: the SDK links a caption to the first sound or film by itself.

## Watch out
- Judge a typecheck by its exit code: searching its output for "error TS" misses every error, as colour codes sit between the two words. Broken types reached CI that way.

In the code: packages/peal-web/src/studio/edit-document.ts (renderedOf, waitsToBeGenerated), src/studio/figures.ts, src/components/studio/use-studio-generator.ts.
