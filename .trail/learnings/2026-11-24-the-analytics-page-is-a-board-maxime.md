---
title: "The analytics page is a board of widgets kept in the person's browser, not on the server"
author: Maxime
date: 2026-11-24
branch: worktree-silly-imagining-snowglobe
cost: { minutes: 1, tokens: 1392 }
id: l-90b6c8e3
scope: repo
status: active
src: agent
touches:
  - packages/peal-web/src/analytics/widgets.ts
  - DESIGN.md
---

## Decided
The owner asked for a dashboard of widgets on the analytics page (2026-11-24): cards of three sizes, each with its own period and, where it makes sense, its own channel, a "…" menu (duplicate, rename, move, remove with Undo), drag to reorder, and an "Add widgets" sheet with search, sections and Reset layout. The board is kept per workspace in localStorage, decoded with Schema, falling back on the default board.

## Tried and ruled out
Keeping the board on the server. It would need a contract endpoint, regenerating the eight SDKs, a table and migration, an entry in the data-processing registry with the privacy policy's table in both languages, and erasure on account and workspace deletion. That is too much for a layout. Move it to the server only once people ask for the same board across devices.

## Watch out
- Lilo's synthetic mouse drag does not start native HTML5 drag and drop in WebKit: it selects text. Check dropping by dispatching DragEvents with a DataTransfer from the page.
- The local `peal_e2e` database can hold another branch's migrations ("relation already exists"): run the end-to-end file on a fresh database.

In the code: packages/peal-web/src/analytics/widgets.ts (kinds, periods, board changes), src/analytics/board-store.ts (key peal.analytics.board.<workspace>), src/components/analytics/widgets/, DESIGN.md "Analytics board".
