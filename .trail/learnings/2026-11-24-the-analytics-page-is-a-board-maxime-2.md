---
title: "The analytics page is a board of widgets kept in the person's browser, moved only by dragging"
author: Maxime
date: 2026-11-24
branch: worktree-silly-imagining-snowglobe
cost: { minutes: 18, tokens: 208505 }
id: l-35173635
scope: repo
status: active
replaces: l-90b6c8e3
src: agent
touches:
  - DESIGN.md
  - packages/peal-docs/docs/fr/guides/engage/analytics.mdx
  - packages/peal-docs/docs/guides/engage/analytics.mdx
  - packages/peal-web/messages/en.json
  - packages/peal-web/messages/fr.json
  - packages/peal-web/src/components/analytics/widgets/analytics-board.tsx
  - packages/peal-web/src/components/analytics/widgets/widget-controls.tsx
  - packages/peal-e2e/tests/threads-analytics-inbox.e2e.ts
  - packages/peal-web/AGENTS.md
  - packages/peal-web/src/analytics/api.ts
---

## Decided
The owner asked for a dashboard of widgets on the analytics page (2026-11-24): cards of three sizes, each with its own period and, where it makes sense, its own channel, a "…" menu with Duplicate, Rename and Remove (Undo in a toast), drag by a handle to reorder, and an "Add widgets" sheet with search, sections and Reset layout. The board is kept per workspace in localStorage, decoded with Schema, falling back on the default board.

The owner then had "Move earlier" and "Move later" taken out of the menu: dragging is the only way to move a widget. Keyboard users cannot reorder the board; offer a key on the handle if that is ever asked for, not the menu items back.
The owner (2026-11-24) wants each analytics widget to show one chart, the one that fits it, and no Chart/Table tabs: the figures stay for screen readers as an sr-only table. Lines on a faint area (followers, engagement, reach), columns (views), a ring (posts by platform), one bar cut into shares (platforms), stacked one-blue columns with the 7-day average (engagement over time), quiet rows with the platform's mark (top posts, channels). Top posts stay minimal: mark, start of the text, day, engagement. Widgets resize from a corner, by whole columns (1 to 4) and rows (1 to 2), blurring while they move, and their charts fill the card.

## Tried and ruled out
Keeping the board on the server. It would need a contract endpoint, regenerating the eight SDKs, a table and migration, an entry in the data-processing registry with the privacy policy's table in both languages, and erasure on account and workspace deletion. That is too much for a layout. Move it to the server only once people ask for the same board across devices.

## Watch out
- Lilo's synthetic mouse drag does not start native HTML5 drag and drop in WebKit: it selects text. Check dropping by dispatching DragEvents with a DataTransfer from the page.
- The local `peal_e2e` database can hold another branch's migrations ("relation already exists"): run the end-to-end file on a fresh database.

In the code: packages/peal-web/src/analytics/widgets.ts (kinds, periods, board changes), src/analytics/board-store.ts (key peal.analytics.board.<workspace>), src/components/analytics/widgets/, DESIGN.md "Analytics board".
- The grid's rows are fixed (20rem), so a body must fill its card: charts take flex-1, lists cut to the rows the height allows.
- In local dev, new Tailwind classes need the files staged and the stylesheet refetched with cache "reload" before a reload shows them.

In the code: packages/peal-web/src/analytics/widgets.ts (sizeFor, resizeWidget, kinds' width and minWidth), src/components/analytics/widgets/widget-bodies.tsx, analytics-board.tsx (startResize, keyResize), DESIGN.md "Analytics board".
