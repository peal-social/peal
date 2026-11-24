---
title: "The analytics page is a board of widgets kept in the person's browser, moved only by dragging"
author: Maxime
date: 2026-11-24
branch: worktree-silly-imagining-snowglobe
cost: { minutes: 62, tokens: 455186 }
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
The owner wants moving a widget to be smooth and to work in any direction, and a short default board (2026-11-24). Widgets move with `@dnd-kit/react`'s sortable, already a dependency of the calendar: the others glide aside as one is carried, and the handle takes the keyboard. A new board starts with Followers, Top posts, Engagement, and Engagement over time two rows high.
The owner (2026-11-24) wants a widget resizable from all four edges and all four corners, as the dashboards it follows do: the card follows the pointer to the pixel and snaps on release; pulled from its start or top, it moves so its other side stays put. The owner also had two lines removed from Analytics as noise: the time zone line above the board and the note on how often counts are read. Do not add explanatory notes to the analytics page; the docs carry them.

In the code: packages/peal-web/src/components/analytics/widgets/analytics-board.tsx (pulls, handlePlaces, startResize), widget-card.tsx (--resize-x, --resize-y), DESIGN.md "Analytics board" and "Time zone".
The owner wants widgets to move as smoothly as possible (2026-11-24): every move on the board (others gliding aside, the drop settling into its slot, a resize gliding to its snap) shares one curve, 320 ms cubic-bezier(0.22, 1, 0.36, 1); the carried widget lifts 2 % with a deep shadow, and its slot shows as a dashed outline.
The owner (2026-11-24) wants every filter to match the app's Linear-style Filter menu: a widget's filter is FilterMenu (search, properties Period and Channel, pages of values), not a popover of selects. A board holds one per widget, so the menu takes a label of its own and no F key. The drag grip sits just outside the card's start edge, borderless, as on the dashboards the board follows.

In the code: packages/peal-web/src/components/analytics/widgets/widget-controls.tsx (WidgetFilter), src/components/lists/filter-menu.tsx (label, shortcut), analytics-board.tsx (SortableWidget's grip: right-full).

## Tried and ruled out
Keeping the board on the server. It would need a contract endpoint, regenerating the eight SDKs, a table and migration, an entry in the data-processing registry with the privacy policy's table in both languages, and erasure on account and workspace deletion. That is too much for a layout. Move it to the server only once people ask for the same board across devices.
Native HTML5 drag and drop with a drop line beside the target: it only reads left or right (or above or below a full-width widget), animates nothing, and cannot be driven from the keyboard.

In the code: packages/peal-web/src/components/analytics/widgets/analytics-board.tsx (SortableWidget, handleDragEnd), src/analytics/widgets.ts (defaultBoard, kinds' height).

## Watch out
- Lilo's synthetic mouse drag does not start native HTML5 drag and drop in WebKit: it selects text. Check dropping by dispatching DragEvents with a DataTransfer from the page.
- The local `peal_e2e` database can hold another branch's migrations ("relation already exists"): run the end-to-end file on a fresh database.

In the code: packages/peal-web/src/analytics/widgets.ts (kinds, periods, board changes), src/analytics/board-store.ts (key peal.analytics.board.<workspace>), src/components/analytics/widgets/, DESIGN.md "Analytics board".
- The grid's rows are fixed (20rem), so a body must fill its card: charts take flex-1, lists cut to the rows the height allows.
- In local dev, new Tailwind classes need the files staged and the stylesheet refetched with cache "reload" before a reload shows them.

In the code: packages/peal-web/src/analytics/widgets.ts (sizeFor, resizeWidget, kinds' width and minWidth), src/components/analytics/widgets/widget-bodies.tsx, analytics-board.tsx (startResize, keyResize), DESIGN.md "Analytics board".
- dnd-kit hides the placeholder it leaves (visibility: hidden), so the slot is drawn by the placeholder's ::after made visible again; dnd-kit copies the item's classes onto it.
- dnd-kit ignores synthetic (untrusted) pointer events: check a move with its keyboard path (focus the handle, Space, arrows), not dispatched PointerEvents.

In the code: packages/peal-web/src/components/analytics/widgets/analytics-board.tsx (motion, glide, boardPlugins with @dnd-kit/dom Feedback), widget-card.tsx (data-[dnd-placeholder]:after:*).
