---
version: alpha
name: Peal
description: "A light, warm-grey product canvas (#FAFAF9) with white cards and tables, ink text (#0C0A09) and the mark's blue (#415EEE) as the one colour that carries meaning: links, focus, selection, today, scheduled. Lavender and yellow, the mark's other colours, are for illustration only. Type is Geist, with Geist Mono for what is read character by character. Structure is drawn with hairline borders, not shadows; a shadow lifts only what floats. The app is dense and keyboard-first: one command menu, one filter bar, one selection bar, the same on every screen."

colors:
  primary: "#0C0A09"
  on-primary: "#FAFAF9"
  brand: "#415EEE"
  brand-hover: "#2F47C9"
  brand-pressed: "#22339A"
  brand-tint: "#E8ECFD"
  brand-text: "#2F47C9"
  lavender: "#B9A6FF"
  lavender-tint: "#EDE7FF"
  lavender-text: "#5B45C7"
  sun: "#FFCA00"
  sun-tint: "#FFF4CC"
  sun-text: "#7A5B00"
  canvas: "#FAFAF9"
  surface-1: "#FFFFFF"
  surface-2: "#F5F5F4"
  surface-3: "#EFEEEC"
  hairline: "#E7E5E4"
  hairline-strong: "#D6D3D1"
  ink: "#0C0A09"
  ink-subtle: "#716B66"
  destructive: "#D92D20"
  destructive-text: "#B42318"
  state-scheduled: "#415EEE"
  state-published: "#16A34A"
  state-approval: "#E0A800"
  state-failed: "#D92D20"
  state-draft: "#A8A29E"
  overlay: "rgb(0 0 0 / 0.1)"

typography:
  display-xl:
    fontFamily: Geist
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.025em
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -0.025em
  display-md:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.025em
  headline:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.025em
  card-title:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.40
    letterSpacing: 0
  subhead:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  button:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.30
    letterSpacing: 0.04em
  mono:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  key:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 34px
  button-outline:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 34px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 34px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 34px
  button-inverse:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 34px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 34px
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  list:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  settings-row:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: 12px 16px
    height: 60px
  switch:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.full}"
    width: 32px
    height: 18px
  table-row:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 44px
  status-badge:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 2px 8px
  state-chip:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-text}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 2px 8px
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    width: 448px
  pixel-icon:
    backgroundColor: "transparent"
    textColor: "{colors.brand}"
    width: 80px
    height: 80px
  tag:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 2px 6px
  key:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.key}"
    rounded: "{rounded.xs}"
    height: 20px
  menu:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 4px
  dialog:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  command-menu:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    width: 576px
  toast:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    width: 384px
  selection-bar:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 4px 4px 4px 16px
    height: 40px
  list-toolbar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 34px
  list-tool-button:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 30px
  filter-chip:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 28px
  view-tab-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  view-tab-selected:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  sidebar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    width: 240px
  sidebar-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 34px
  bottom-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 44px
  sidebar-head:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 48px
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    margin: 8px
  panel-header:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 48px
    padding: 0 16px
  site-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 56px
  site-footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body-sm}"
    padding: 48px 16px
  code-block:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.lg}"
    padding: 16px
---

# Peal design

How Peal looks and is laid out: the web app first, and the site and the docs
after it. `packages/peal-ui/src/styles/tokens.css` carries these values as
plain CSS variables. The web app and the site read them through
peal-ui's `globals.css`, and the docs through
`packages/peal-docs/theme.css`. Change this file and the
tokens together: `nx run peal-ui:test` fails when the colour tables or the
radius here and the tokens differ. Contributors and agents read this before
changing a screen, and never depart from it: a screen that needs something
else changes this file first.

This file follows the `design.md` format: the front matter holds the
tokens (`{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`) and
the components built from them, and the sections below say how and where
they are used.

## Overview

Peal is light only, on a warm-grey canvas (`{colors.canvas}`, #FAFAF9).
Content sits in white (`{colors.surface-1}`) cards, lists and tables, cut
by 1 px hairlines (`{colors.hairline}`); quiet fills step up through
`{colors.surface-2}` (#F5F5F4) and `{colors.surface-3}` (#EFEEEC, hover
and the current item). Ink (#0C0A09) carries text, and the page's main
action is an ink button.

The one colour that means something is the mark's **blue**
(`{colors.brand}`, #415EEE): links, focus rings, selection, today, and
the scheduled state. Lavender and yellow, the mark's other colours, are for
illustration, and yellow also marks what waits for an approval. A post's
state is the only other colour a list carries.

The app is dense, keyboard-first, and the same
on every screen. One command menu (`⌘K`) reaches every page and action;
every list narrows and orders with one Filter menu and one Display panel;
several items are chosen and acted on with one selection bar; every change
that can be taken back offers Undo instead of asking first.

**Key characteristics:**

- **Light only** — one theme; no `dark:` class anywhere in Peal's own code.
- **Blue for meaning only** — selection, focus, links, today, scheduled;
  never a button, never decoration.
- **Hairlines before shadows** — a shadow lifts only what floats.
- **A 4 px base**, one spacing scale, and one set of component sizes.
- **Geist and Geist Mono**, with negative tracking on large type only.
- **Keyboard-first** — every action has a command, many a key, and a sheet
  lists them all.

## Light only

Peal has one theme, light. There is no dark mode yet, so no screen follows
the operating system's setting and none offers a switch:

- peal-ui, shadcn/ui's components on ui-sdk's behaviour, sets
  `color-scheme: light` and defines no dark tokens. Its `dark:`
  variant matches a `.dark` class that nothing sets, so the `dark:` classes
  shadcn/ui's components bring with them stay inert.
- Write no `dark:` class in Peal's own code, in the web app or the site.
- The docs set Blume's `theme.mode` to `light`, without its toggle.

## Colors

### Brand

The three colours of the mark (`packages/peal-web/src/app/icon.svg`):

| Name     | Value     | Use                                                          |
| -------- | --------- | ------------------------------------------------------------ |
| Blue     | `#415EEE` | The accent: links, focus rings, selection, today, scheduled. |
| Lavender | `#B9A6FF` | Illustration and fills only.                                 |
| Yellow   | `#FFCA00` | Illustration, highlights and the needs-approval dot.         |

Blue is the only colour that carries meaning on its own. Lavender (2.1:1)
and yellow (1.5:1) fail contrast on white: never use them for text, for
icons or for a line that must be seen. For text on their tints, use these
pairs:

| Tint      | Text      | Contrast |
| --------- | --------- | -------- |
| `#E8ECFD` | `#2F47C9` | 6.2:1    |
| `#EDE7FF` | `#5B45C7` | 5.6:1    |
| `#FFF4CC` | `#7A5B00` | 5.7:1    |

Blue's hover is `#2F47C9`, its pressed state `#22339A`. White on blue is
5.2:1.

### Surface and text

Warm greys (stone), from the page out. The token names are peal-ui's; the
front matter's surface ladder maps onto them (`canvas` is `background`,
`surface-1` is `card`, `surface-2` is `muted`, `surface-3` is `accent`,
`hairline` is `border`, `hairline-strong` is `input`):

| Token                | Value     | Use                                                 |
| -------------------- | --------- | --------------------------------------------------- |
| `background`         | `#FAFAF9` | The page and the sidebar, around the panel.         |
| `card`, `popover`    | `#FFFFFF` | Tables, cards, menus, dialogs, inputs.              |
| `muted`, `secondary` | `#F5F5F4` | Code blocks, prompts, quiet fills.                  |
| `accent`             | `#EFEEEC` | Hover, and the current item in the sidebar.         |
| `border`             | `#E7E5E4` | Every border and divider.                           |
| `input`              | `#D6D3D1` | The border of a field.                              |
| `foreground`         | `#0C0A09` | Headings and body text.                             |
| `muted-foreground`   | `#716B66` | Secondary text and placeholders (4.8:1 on `muted`). |

`primary` is the ink, `#0C0A09` with `#FAFAF9` on it: the main action of a
page is a black button. Blue is for what is selected or links somewhere,
not for buttons.

### States

A post's state has a colour, and nothing else in a list does. Each pairs a
dot, a tint and a text colour:

| State          | Dot       | Tint      | Text      |
| -------------- | --------- | --------- | --------- |
| Scheduled      | `#415EEE` | `#F2F4FE` | `#2F47C9` |
| Published      | `#16A34A` | `#F0FDF4` | `#166534` |
| Needs approval | `#E0A800` | `#FFFBEB` | `#92400E` |
| Failed         | `#D92D20` | `#FDECEC` | `#B42318` |
| Draft          | `#A8A29E` | `#F5F5F4` | `#44403C` |

`destructive` is `#D92D20` (white on it is 4.8:1); `destructive-text`,
`#B42318`, is for text on its tint. States that must be told apart also
differ in lightness, not hue alone.

### Code

Code sits on `muted` in Geist Mono, and its syntax takes its colours from
the palette above, with none of its own: each kind of token borrows a text
colour Peal already uses for something else. `tokens.css` holds them as
`--code-*`. The site's highlighter (Shiki, run at build time) names those
variables rather than values, so each colour is written once.

| Kind                                  | Token              | Value     | From               | On `muted` |
| ------------------------------------- | ------------------ | --------- | ------------------ | ---------- |
| Text, names and calls                 | `code-foreground`  | `#0C0A09` | `foreground`       | 18.1:1     |
| Comments                              | `code-comment`     | `#716B66` | `muted-foreground` | 4.8:1      |
| Punctuation and operators             | `code-punctuation` | `#716B66` | `muted-foreground` | 4.8:1      |
| Keywords, and JSON's keys             | `code-keyword`     | `#2F47C9` | Blue's text        | 6.7:1      |
| Strings                               | `code-string`      | `#166534` | Published's text   | 6.5:1      |
| Numbers and constants (`true`, `nil`) | `code-constant`    | `#5B45C7` | Lavender's text    | 6.1:1      |
| Types and classes                     | `code-type`        | `#7A5B00` | Yellow's text      | 5.7:1      |
| Errors and deletions                  | `code-deleted`     | `#B42318` | `destructive-text` | 6.0:1      |

`code-background` is `muted`. Ratios are WCAG's, rounded down; each clears
4.5:1. Nothing is bold or italic. The kinds differ by colour alone, and
none of them is needed to read or run the code.

## Typography

### Font family

- **Geist** — every word of the interface, the site and the docs.
- **Geist Mono** — what is read character by character: ids, slugs, keys,
  times, counts, code and keyboard shortcuts; the site's eyebrows and
  captions.

peal-ui ships both (`peal-ui/lib/fonts`); the docs name `geist` and
`geist-mono` in Blume.

### Hierarchy

| Token                     | Size (phone) | Weight | Line height | Letter spacing | Use                                                                     |
| ------------------------- | ------------ | ------ | ----------- | -------------- | ----------------------------------------------------------------------- |
| `{typography.display-xl}` | 56 (36)      | 600    | 1.05        | -0.025em       | The site's hero headline, one per page.                                 |
| `{typography.display-lg}` | 40 (30)      | 600    | 1.10        | -0.025em       | The site's section headlines; a second sentence muted.                  |
| `{typography.display-md}` | 30           | 600    | 1.20        | -0.025em       | The app's home headline, two lines, the second muted.                   |
| `{typography.headline}`   | 24           | 600    | 1.25        | -0.025em       | Page titles.                                                            |
| `{typography.card-title}` | 15           | 600    | 1.40        | 0              | Section headings, cards' and tiles' titles.                             |
| `{typography.subhead}`    | 18 (16)      | 400    | 1.50        | 0              | The site's leads, at most 40 rem wide.                                  |
| `{typography.body}`       | 14           | 400    | 1.50        | 0              | Body and controls; 500 for the current item and labels.                 |
| `{typography.body-sm}`    | 13           | 400    | 1.45        | 0              | Hints, cells' second line.                                              |
| `{typography.caption}`    | 12           | 400    | 1.40        | 0              | Table headers (upper case), group labels, badges.                       |
| `{typography.button}`     | 14           | 500    | 1.20        | 0              | Every button's label.                                                   |
| `{typography.eyebrow}`    | 12           | 400    | 1.30        | 0.04em         | Geist Mono, lowercase, in muted text: the site's eyebrows and captions. |
| `{typography.mono}`       | 13           | 400    | 1.50        | 0              | Code.                                                                   |
| `{typography.key}`        | 12           | 400    | 1           | 0              | Keys (see Keys).                                                        |

"Phone" is below 640 px.

### Principles

- **Tracking pulls in on large type only**: `-0.025em` at 24 px and above,
  none below.
- **One voice**: 600 for what heads, 400 for what is read, 500 for labels
  and the current item. No 700.
- **Numbers that line up** use `tabular-nums`.
- **Mono means "read me exactly"**: ids, keys, times, counts, code. Never
  for emphasis.

## Layout

### Spacing system

- **Base unit**: 4 px. Everything sits on the 4 px grid.
- **Tokens**: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 ·
  `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 ·
  `{spacing.xxl}` 48 · `{spacing.section}` 96.
- Pages have `{spacing.md}` 16 px of padding inside the content area on a
  phone, `{spacing.xl}` 32 px from 768 px.
- Card and dialog interior: `{spacing.lg}` 24 px. A list row: 12 px by
  16 px. A menu: 4 px around its rows.
- Between blocks of a page: `{spacing.lg}` 24 px; between a heading and
  its block: `{spacing.sm}` 12 px; between controls in a row:
  `{spacing.xs}` 8 px.
- Button padding: 8 px by 14 px. Field padding: 8 px by 12 px.
- The site's sections: `{spacing.section}` 96 px apart (48 px on a phone).

### Heights

- Heights: controls 34 px (30 small, 38 for a toolbar's search); sidebar
  rows 34; table rows about 44; the sidebar's head and the panel's header
  48; the site's header 56.

### Grid and container

- The app's content is 72 rem (1152 px) wide at most, centred.
- The site's column is 72 rem wide at most, with 16 px of gutter on a
  phone, between its rails (see Site).
- Grids of cards or tiles are four, three or two up, one on a phone.

## Elevation and depth

| Level | Treatment                                                   | Use                                                           |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 0     | `{colors.canvas}`, no border                                | The page and the sidebar.                                     |
| 1     | `{colors.surface-1}`, 1 px `{colors.hairline}`              | Cards, lists, tables, fields.                                 |
| 2     | `{colors.surface-3}`                                        | Hover, the focused row, the current sidebar item.             |
| 3     | `{colors.surface-1}`, a ring of ink at 10%, a medium shadow | Menus, popovers, tooltips.                                    |
| 4     | `{colors.surface-1}`, the ring, a large shadow              | Dialogs, the command menu, sheets, toasts, the selection bar. |
| Focus | A 3 px ring of `{colors.brand}` at 50%                      | Every focused control.                                        |

Borders before shadows. A shadow lifts only what floats: menus,
popovers, dialogs, the selection bar, the selected segment of a switch.
A modal's backdrop is ink at 10%.

## Shapes

| Token            | Value | Use                                                                                               |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------- |
| `{rounded.xs}`   | 4px   | Keys, status badges, state chips, checkboxes, the command menu's chip.                            |
| `{rounded.sm}`   | 6px   | Tags, filter chips, a menu's rows.                                                                |
| `{rounded.md}`   | 8px   | Buttons, fields, selects, menus, popovers, toasts, sidebar rows, view tabs and any tab-like chip. |
| `{rounded.lg}`   | 12px  | The panel, cards, lists, tables, dialogs, the command menu, code blocks.                          |
| `{rounded.xl}`   | 16px  | The site's product panels (the hero stage).                                                       |
| `{rounded.pill}` | full  | The selection bar and its buttons, the agent's send button and its suggestions.                   |
| `{rounded.full}` | full  | Avatars and dots.                                                                                 |

- Radius: 8 px for controls, menus, popovers and toasts; 12 px for the
  panel, cards, lists, tables and dialogs; 4 px for keys, status badges
  and state chips; 6 px for tags and filter chips; full for avatars,
  dots, the selection bar (with its buttons) and the agent's send
  button and suggestions (Button's `corners="round"`). In Tailwind,
  `rounded-sm` is 4 px, `rounded-md` 6, `rounded-lg` 8 and `rounded-xl`
  12, all from `--radius`.

## Icons

lucide, at 16 px in navigation and buttons (stroke 1.75) and 12 to 14 px in
chips (stroke 2), in `currentColor`. An icon-only button has an
`aria-label`. Platforms are shown by their own marks: simple-icons', or,
for a brand it does not hold (LinkedIn, Slack, Google Business Profile),
the file its owner publishes, kept in peal-ui's `src/brand-marks` with
where it came from; a lettered tile only for a brand with neither. Never
draw a platform's logo from memory.

A sign-in provider's button is an `lg` button the column's width, the
provider's own mark at 16 px, as Google sets its 20 px G in a 40 px
button (Google's full-colour "G": the paths of the file its branding
guidelines publish, inline and without that file's white square, as
Google's dark button sets it, never redrawn or monochrome; lucide's
`KeyRound` for a provider without one), then "Continue with" and its
name. Google's follows the same rule as every way in: the ink button
when first, outline after. Email is one of these ways,
**Continue with email** with lucide's `Mail`, and opens the form (see
`sign-in` under The frame).

## Components

Each component below names its token in the front matter. peal-ui builds
them from shadcn/ui's look on ui-sdk's behaviour; a page never restyles
one, it asks for a variant or a size.

### Buttons

**`button-primary`** — The page's main action: ink, `{colors.on-primary}`
text, 8 px by 14 px, `{rounded.md}`, 34 px high. One per page.

**`button-outline`** — Every other action: white, 1 px
`{colors.hairline}` border, ink text. Every way in on a sign-in page but the first is one.

**`button-ghost`** — Actions in a toolbar or a row: no fill until hovered
(`{colors.surface-3}`).

**`button-destructive`** — Removal that cannot be taken back, in a
confirmation only: `{colors.destructive}` with white text.

**`button-inverse`** — On the brand field only: white with ink text.

Sizes: default 34 px, `sm` 30 px, `xs` 24 px, `lg` 38 px (a toolbar's
search); icon buttons are square at the same heights. A ghost button that
is a toggle (`aria-pressed`) takes `accent` while pressed.

### Fields

**`text-input`** — White, 1 px `{colors.hairline-strong}` border, 8 px by
12 px, `{rounded.md}`, 34 px high; the focus ring is blue at 50%. A select's
trigger, a combobox and a date field share the look.

### Lists, cards and tables

**`card`** — White, 1 px `{colors.hairline}`, `{rounded.lg}`, 24 px
inside. Settings are rows in cards: label and hint on the left, the
control on the right, grouped under a heading, with what cannot be undone
last (see [Settings](#settings)).

**`settings-row`** — One setting in a settings card: its label (14 px, 500) and a muted hint (13 px) at the start, its control at the end, 12 px
by 16 px inside, 60 px high at least, a hairline between rows. On a phone
the control takes a line of its own under the text.

**`switch`** — A setting that applies as soon as it changes: a track 32
by 18 px, `input` when off and ink when on, its white thumb sliding to the
end. Its label says what the setting is and never changes with it.

**`list`** — A list page's items sit in one bordered list,
`{rounded.lg}`, a hairline between rows, never a card each. A row is 12 px
by 16 px inside and opens what it shows. A row's own actions sit at its
end as `xs` ghost buttons, icon first, each naming its item for a screen
reader: a post that waits for an approval offers **Approve** and
**Request changes** to members who may approve, as its page does. On a
phone they take a line of their own under the item's text, aligned with
it, and wrap there, so the text keeps the row's width.

**`table-row`** — About 44 px; headers in `{typography.caption}`, upper
case, muted.

### Badges, chips and tags

**`status-badge`** — A post's status beside it: 1 px hairline,
`{rounded.xs}`, `{typography.caption}`, 2 px by 8 px.

**`state-chip`** — Where a state is the point (the calendar's chips), the
state's tint and text from the States table, with its dot. A post's state
is the one colour a chip carries.

**`tag`** — A workspace's tag: its dot (`TagDot`) and its name, on white,
1 px hairline, `{rounded.sm}`. A tag's colour shows in its dot only.

### Keys

**`key`** — Keys are shown as **keys**: Geist Mono 12 on `muted`, 20 px
high, the 4 px radius. Two pressed one after the other read "G then C",
the word in muted text and in the reader's language.

- **C** opens a new post; **G then** a letter opens the pages people open
  most (H home, C calendar, P posts, I inbox, M media, Y analytics, S
  settings) and two tabs of the posts list (D Drafts, A Needs approval).
  Letters are the same in every language. **⌘J** (Ctrl+J) opens the
  agent's panel on a new chat, or hides it.
- A letter never runs while focus is in a field or while a dialog is
  open; keys with ⌘ or Ctrl always do. Every key the app binds is shown
  beside its command in the command menu.
- **⌘/** (Ctrl+/; ⌘⇧/ where / takes Shift, as on a French keyboard), or
  "Keyboard shortcuts" in the command menu's Help, opens the **shortcut
  sheet**: a sheet on the right, its title, a search field (what a line
  does, or its group's name), then the groups General, Go to, Lists and
  Selected posts, each line what it does in muted text with its keys at
  the end (a second way after the first, like J and ↓). It lists every
  shortcut, not only the page's, and only "Go to" lines for pages the
  member may open. The lines come from the same constants the pages
  bind (`#shell/keys.ts`), so the sheet cannot drift from them.
- A list's single keys never take the second key of a G sequence.

### The frame

Every signed-in page has the same frame, but the setup page (below): the
sidebar on the page's `background`, and the page in a white panel beside
it. There is no bar across the top.

- **`sidebar`**, 240 px, on `background`, with no border:
  - Its **head** (`sidebar-head`, 48 px): the workspace switcher (the
    workspace's tile, its name, a chevron; its menu ends with **New
    workspace**, the setup page), then at the end two ghost icon buttons, **Search** (the
    command menu, ⌘K) and **New post** (C), each with a tooltip naming it
    and its key.
  - The **modes**: PealCreative, for running a workspace's channels, and
    PealAPI, for building on the API. They are the site's product names,
    one word each, never translated. Each page belongs to one mode, so the
    address carries it.
  - The mode's navigation, in groups with a small label where the mode
    has groups, listing only the pages the member's permissions open, in
    **`sidebar-row`**s (34 px, `{rounded.md}`, the current one on
    `accent`). A section with pages of its own (Posts, Automations and
    Settings) shows a chevron and **drills down**:
    on its pages, the sidebar shows that section's pages under a back link.
  - Its **foot**: Settings.
- **`panel`**: the page, white (`card`), a 1 px hairline, `{rounded.lg}`,
  8 px from the window's top and right edges, its foot on the bottom bar.
  It scrolls on its own; the sidebar stays. On a phone it fills the
  window, under a 48 px bar holding the menu button, the page's name and
  its actions.
- **`bottom-bar`**, 44 px, across the window's foot, on `background`, as
  at its start, under the sidebar, the **account**: the
  person's round avatar alone (their picture, or their initial on the
  blue tint), a blue dot at its corner while notifications wait unread.
  It opens their menu: Notifications (with the unread count), Account
  settings (their Profile, in the workspace's Settings), then Sign out. Beside it, on a workspace's pages, the **mode switch**:
  the open mode's name (14 px, 500), no mark, and **Switch**, an outline
  `xs` button shown while the row is hovered, focused or its menu open.
  Switch opens a menu beside it, each mode a row with its name and one
  muted line saying what it is for; choosing one opens that mode's
  first page the member may open, and a mode with none is shown
  disabled, saying why. At the
  bar's end, **Help** (Docs, Support, Keyboard shortcuts) and the
  **agent's** place, for members who may use the assistant (see
  [The agent](#the-agent)): its chats open in the panel as tabs,
  **Agent** and **History**. No bell, no language switcher in the
  frame.
- **`panel-header`**, 48 px, a hairline under it, held at the panel's
  top: the breadcrumb (the steps the page is nested under, in muted
  text, each a link back to it that turns ink on hover, then the page's
  name, 14 px, 500, the page's `h1`) and at its end the page's actions
  as small ghost buttons ("+ New post"). A page nested under another
  is reached back through the breadcrumb, never a "Back" link of its own
  ("Channels › New channel › Mastodon"; "Posts › Articles › Article").
  A page draws no title of its own under it, and no description: what a
  page holds is said by its empty state.
- **Content** under the header: a list's toolbar first (its views and
  tools, 8 px from the panel's edges, see Lists), then the list edge to
  edge; forms and settings in a column 48 rem wide at most, centred, 24 px
  from the header (see [Settings](#settings)); full-bleed tools (the
  calendar, the inbox, the composer) fill the panel.
- **`setup`**: the page where a workspace is made: someone with no
  workspace makes their first at `/`, and **New workspace** opens it at
  `/create`, the name empty. It has no frame of the app's, no sidebar and
  no bottom bar: the window's `background` alone, as a sign-in page. A
  bar 48 px high across its top holds, at its start, **Back** (a small
  ghost button, an arrow first) to the person's workspace when they have
  one, and at its end "Signed in as …" in muted text with **Sign out**
  (a small ghost button); the contract functions close the page, in small
  muted text. The content is a column 24 rem wide, centred, 96 px from
  the top: a title (`headline`, centred, the page's `h1`) with one muted
  line under it, then the form: **Name**,
  then **URL** as one field: the site's address in a segment of its own
  (peal-ui's `InputGroupAddon variant="segment"`: `{colors.surface-2}`,
  muted text, a hairline after it), then what the person types, and the
  button the column's width. Under the URL,
  only what stops the workspace being made (taken, or a word it cannot
  be), in destructive text. Only this page draws its own title. Once
  the workspace is made, its second step opens in the same frame, at
  `/create/<slug>/channels`: the **setup card** (below), in a column
  36 rem wide, centred, 96 px from the top, its title the page's `h1`.
  Every way off it leads to the workspace's home: **Skip for now**,
  **Stop**, and the end. Home itself holds no setup card.
- **`sign-in`**: the pages where someone signs in, signs up or gets back
  in (a forgotten password, a new one, a confirmed address). No frame of
  the app's and no header: the window's `background` alone, a column
  24 rem wide centred in the window, then at the window's foot the
  contract functions alone, in small muted text: no language switcher
  (the page follows the browser's language, or the address's `/fr`).
  The column holds Peal's mark (48 px), the title (`headline`, centred,
  the page's `h1`: "Sign in to Peal", "Create your account"), then the
  ways in, one button each, stacked: the way this browser used last
  first, as the page's primary button, with a muted line under it ("You
  used Google to sign in last time"); without one, the server's first
  provider; every other way outline. **Continue with email** opens the
  form in their place, with **Back** (a ghost button) under it, the
  one fading in as the other goes (300 ms, easing out); a
  server with no provider shows the form at once. On the sign-up page
  the terms line follows, centred, its documents' names as ink links:
  the terms of service, the privacy policy and the data processing
  agreement, each where the server names it.
  Last, centred and muted, the way to the other page with its link in
  ink ("Don't have an account? **Sign up**"). No card. As a page opens,
  the column fades in and rises 8 px (500 ms, easing out), so going
  from one page to the other reads as a step. With reduced motion, nothing
  moves. The pages are at `/login` and `/signup`.
- The contract functions close the panel's content, in small muted text.

PealCreative holds, in this order: Home, Agent and Channels without a
label; then **Studio**, what makes and plans the posts: Editor, Posts,
Calendar and Media; then **Engage**, what answers and measures them:
Inbox, Analytics and Ads. Posts drills down to the posts list (its
states as tabs), Articles and Import. Automations (Queues, Repeating
posts, Follow-ups, Feeds and Comment rules) are in Settings. The creator
tools are the composer, which New post (C) opens full-bleed with the
writing assistant, the media library and the signatures inside it, and
the editor (below). PealAPI holds Platforms, then API keys and Webhooks
under Build, and Partner under Partners; a page the API offers later
(connect links, activity, usage, OAuth apps) joins it there. Settings
keeps the person's own pages first, then what runs the workspace, in the
groups [Settings](#settings) lists. The person's own pages (Profile,
Preferences, Notifications, Email notifications, Security and access,
Agent) are in every workspace's Settings.

Each workspace stands alone: no page reads across workspaces, and there is
no sidebar of the person's (an agency sees its clients' workspaces
together in PealAPI's Partner, or builds its own view with the SDKs).

**Page names.** A page has one name, used in the sidebar, the breadcrumb,
its title and the browser's tab ("Posts · Synthetic studio", and "Create
a workspace · Peal" on the setup page): the short
one (Posts, Notifications, Billing, Account). A page
that opens one item is named after the item's kind (Comment, Message,
Review). A state of a list is a tab of its page, never a page of its own:
drafts and the posts that need an approval are tabs of Posts. Home keeps "Write once." as a greeting under the name.

### The editor

Studio's **Editor** makes a video of the library's pictures, videos and
sounds and of texts, on tracks. Shotstack's Studio SDK is its engine
(the document, every change, undo and redo, the playback and the
preview's canvas); every control around it is Peal's, built from peal-ui
and ui-sdk's behaviours (toolbar, listbox, slider, select), in Peal's
look: the SDK's own timeline, toolbars and theme are never loaded. Its
export is the workspace's own Shotstack account, as slide videos are. It
shows only to members who may compose one (assistant:use and
media:upload).

- The panel's header holds **Export video** (a small ghost button, its
  icon first), disabled until there is a clip.
- The **toolbar** above the stage, one tab stop with arrow keys between
  its controls: **Add files** (the library's picker), **Add text**, then
  Undo and Redo (icon buttons), **Duplicate** and **Delete** for the
  chosen clip, and **Start over**, in small ghost buttons with a hairline
  between groups.
- The **stage**, on `muted` with a hairline, `{rounded.lg}`, 48 % of the
  window's height: the SDK's canvas, fitted to it. Before the first clip,
  it says to add a file or a text.
- The **transport** under it: back to the previous edge, play or pause,
  on to the next edge (a toolbar of ghost icon buttons), then the
  playhead as a slider along the whole width (a 4 px rail, the played
  part in `primary`, a round thumb with a `primary` edge), then the time
  in mono figures, "0:04.3 / 0:12.0". Under it, in small muted text,
  where an export goes and how many are left today, and a refusal above
  it.
- The **inspector** beside the stage, 20 rem, as tall as the stage and
  the transport and scrolling inside: the chosen clip's sections under
  small headings (its timing; its sound: volume, what it skips, fades;
  its words and style: font among Peal's offered fonts, size, weight,
  colour, alignment, background and box; its layout: fit, position,
  offset, scale, opacity; its motion, how it comes in and goes out, and
  its filter), then the video's (shape, resolution, frame rate,
  backdrop). A number applies when it is left or on Enter, a slider when
  it is let go, a choice at once: each is one undo. On a phone it goes
  under the stage.
- The **timeline**, a bordered card under them, its header naming it
  with zoom out and in: a ruler that seeks where it is pressed, then one
  row per track, the first on top as the video layers them, each named
  in a muted column with its delete button. Clips sit where they start,
  as wide as they last, tinted by what they hold (pictures
  `brand-tint`, texts lavender, videos a lighter lavender, sounds a sun
  tint), with their icon and name; the chosen one is ringed in
  `primary`. Dragging a clip moves it, up or down to another track;
  dragging its edges trims it; both snap to the playhead, the start and
  the other clips' edges. The clips are one listbox, arrow keys between
  them; with one chosen, Alt and an arrow moves it, with ⌘ or Ctrl
  changes its length, Shift for whole seconds, Delete removes it. The
  playhead is a 2 px `primary` line across the tracks. A muted line at
  the foot says the keys.
- Space plays or pauses, ⌘Z or Ctrl+Z undoes and with Shift redoes,
  outside a field.
- Exports on their way show under the timeline as the library's
  placeholders do, and a toast says when one lands in Media or why it
  failed.
- Without Shotstack chosen, the page is an empty state that links the
  assistant settings (or asks an owner); without a payment method where
  one is needed, an empty state whose button opens the upgrade dialog.

### The agent

A chat in which a person asks about their workspace and has Peal do
things there, as they would with a colleague. Chats are the person's own.

- **The agent page** (`…/agent`, Agent in PealCreative's navigation, its
  icon lucide's `Bot`): no title of its own under the header. The Peal
  mark as a watermark, 288 px (384 from 768 px) at 10% opacity, in the
  upper half of the panel behind the content; then, in a column 48 rem
  wide, the composer, under it "Get started with some examples" (muted,
  14 px, 500) with a × that hides them in this browser, three example
  cards three up (one on a phone: white, hairline, `{rounded.lg}`, 16 px
  inside, an icon at 16 px in muted text, a title 14 px 500, one line
  12 px muted; a card sends its prompt at once), then "Recent chats", a
  bordered `list` of the latest eight: the chat's title, a star when
  favoured, and at the row's end how long ago it moved ("just now",
  "2 hr. ago"), 12 px muted.
- **A chat's page** (`…/agent/<chat>`, under Agent in the breadcrumb):
  the chat's title (or "New chat") is the page's name. The header's
  actions are the **chat switcher** (a ghost icon button, a chevron:
  **New chat**, then the chats grouped by day under Today, Yesterday
  and a date, each with how long ago), the **star** (favourite, a
  pressed toggle), **…** (Rename ⇧R, Copy as markdown, then Delete
  ⌘⌫, which asks first) and **Move to panel** (a small ghost button,
  an icon first), which opens the chat in the panel and the agent page
  in place. The messages sit in a column 48 rem wide, the composer
  sticky at its foot.
- **Messages**: a date line ("Today 10:48 AM", 12 px muted, centred)
  above the first. The person's message right-aligned in a `muted`
  bubble, `{rounded.lg}`, 85% wide at most. The agent's answer full
  width, no bubble, 14 px with a relaxed line height: paragraphs, lists,
  bold (600), italics, inline code (Geist Mono on `muted`, 4 px radius)
  and links to Peal's own pages in blue's text; an address out of Peal
  is no link, only its words. Under a
  finished answer, `xs` ghost icon buttons: thumbs up, thumbs down
  (pressed toggles) and copy.
- **Work under way** reads as a line, never a spinner: "Thinking…"
  until the first words; the text streams in, and each step shows as a
  muted line in the present ("Looking at posts…") where it falls in the
  text, so what the agent wrote before a step stays above it. While it
  waits, a light passes along its text (`text-shimmer`, 2 s, from start
  to end); with reduced motion, it is still and muted. Once the answer
  ends, the steps and the text written before them fold into "Worked for
  7 seconds" with a chevron, and only the text after the last step, the
  answer, stays in view. Opened, the fold shows, in order, the text
  before each step and the step's line in the past tense, behind a
  hairline at their start. An answer without steps has no fold.
- **Result cards**: an item the agent made or changed, under its
  answer, one a row (the panel is too narrow for two): white, hairline, `{rounded.lg}`,
  12 px inside, what happened (12 px, 500, muted: "Created post"), the
  start of the item's text (two lines at most), its channels as outline
  badges and when it goes out. The card is the link to the item; a
  deleted item's card links nowhere.
- **Approval card**: a change others see, that cannot be undone or that
  costs money waits for the person. White, hairline, `{rounded.lg}`,
  16 px inside: what the change does (14 px, 600: "Schedule this
  post", "Hide this comment", "Delete this comment"), the text it sends
  whole on `muted` (a reply; an edit's new text under "New text"; a
  request's comment under "Your comment"), then all that goes out of the
  post it acts on: its text on `muted`, its media one a row, an 80 px
  thumbnail (`{rounded.md}`, zoom cursor) that opens the file whole in
  the media library's preview dialog (an image at the window's size, a
  video with its controls), and beside it the alt text whole (12 px
  muted, its line breaks kept; "No alt text" in italics for none), its
  poll's choices, what it has instead on a channel ("Instead, on Client
  A", and "No media on this channel" when it shows none), each part
  after it ("1st part after the post, right after the one before"),
  each channel's settings as a list of fields (the field in Geist Mono
  12 px muted, its value 14 px; a file a field names, such as a cover,
  as its thumbnail), and "Links go out shortened." when they do; each
  block under a 12 px 500 muted label, 12 px apart. Then the channels
  and tags as outline badges, when on the person's clock (or the
  queue's next free slot, said as where it would go for now) in muted
  text, then **Approve** (primary, `sm`) and **Decline**
  (outline, `sm`), with "Open the post" in blue's text at the end. Once
  answered, an outline badge at the title's end says Approved, Declined,
  Expired (after a day too) or "Changed since, not done" (the post was
  edited after the card was shown), or "Approved, not done" when the
  change then failed, and the buttons go. Everything on it comes from
  the request, never from the agent's words; what the server cannot show
  whole is never asked.
- **The composer**: a white field, hairline, `{rounded.lg}`, 8 px
  inside, growing with its text to 192 px, then scrolling; the focus
  ring on the whole field. At its end the send button, primary, round
  (`icon-sm`, `{rounded.pill}`), an arrow up; while a run goes, the same
  button is Stop, a filled square. Enter sends, Shift+Enter breaks the
  line, Escape leaves the composer (the chat's keys then act). Before the
  send button, **+** (a ghost round `icon-sm`) opens a menu above it:
  **File** (⌘⇧U), files from the computer added to the media library
  and attached to the message, each a chip above the text (its name, a
  spinner on its way, × to take it off; sending waits for them), and
  **Skill**, a submenu of the person's skills (lucide's `Box`, the name,
  "Workspace" in muted 12 px at the row's end for a shared one), then a
  separator and **Create skill…**, which opens the new skill's page;
  with no skill, Create skill… alone.
- **Skills in a message**: typing "/" at the start of the text or of a
  word opens the "/" menu above the text at the "/" (a `menu`, 256 px
  wide): the skills whose name holds what follows the slash, whatever
  its case, then a separator and **Create skill…** last. The arrows move
  the highlight while the caret stays in the field, Enter or Tab picks,
  Escape closes it, and Enter never sends while it is open; a query
  with a space that no name holds closes it, so a sentence can start
  with "/". Picking takes the "/" and the query out of the text. A
  picked skill is a chip beside the files' (`muted`, lucide's `Box`,
  the name, × to take it off), three at most: a fourth is not offered,
  nor one picked already. A message with skills and no text of its own
  sends their names as its text. The person's sent message shows its
  skills as outline chips, as its files', under the bubble.
- **The agent's settings** (`…/settings/agent`, Agent in Settings, for
  those who may use the agent): the skills the person may use in one
  bordered `list`, each row the name (500), an outline badge
  "Personal" or "Workspace" and, at its end, "Updated Nov 22, 2026"
  (12 px muted); **New skill** in the header's actions; with none, the
  empty state saying what a skill is, New skill its primary button. A
  skill's page (`…/settings/agent/skills/<id>`, named by the skill,
  under Settings › Agent in the breadcrumb; `…/skills/new` is New
  skill) is a form in the settings column: Name (with how many
  characters it takes), Instructions (a textarea of ten rows, counted),
  "Who can use it" as two radios, each with its line (Personal: only
  you; Workspace: every member who may use the agent), for those who
  manage the assistant's settings only (anyone else's skills are
  personal, and the radios do not show), then **Save**
  (primary) and **Cancel** (outline). Its **…** in the header offers
  **Use in chat**, which opens the agent page with the skill picked,
  and **Delete**, after a dialog saying it cannot be undone. A
  workspace skill the person may not change shows its form disabled,
  with a muted line saying only those who manage the assistant's
  settings change it, and neither Save nor Delete.
- **Off**: where no model answers, the page and the panel say so in the
  empty state's title and line, with the next step as the primary
  button (the assistant settings for those who may change them, the
  billing page for a payment method), or a line saying whom to ask.
  The composer stays, disabled.
- **The panel** (`agent-panel`): a white card, hairline, `{rounded.lg}`,
  the large shadow, 400 × 600 px at the window's bottom right, 8 px
  from its right edge and 8 px above the bottom bar, over the page (a
  phone: the window less 8 px a side, above the bottom bar). Its header,
  48 px with a hairline, names the chat (14 px, 500) with **…** right
  after the title, then at the end minimize, open as a page and close,
  all ghost icon buttons of one size on one line; a long title ends in
  an ellipsis, bringing **…** beside the others. Empty, it
  shows the Peal mark (40 px), "Welcome to Peal" (the empty state's
  title), one muted line and the examples as round outline `xs`
  buttons; the composer is at its foot ("Ask about your posts, channels
  or comments"). It stays open across the workspace's pages and
  reloads, in this browser.
- **The bottom bar's agent place**: each chat open in the panel is a
  tab (its title, truncated at 160 px, 12 px, an `xs` × to close it;
  the one shown on `accent`; hidden on a phone), then **Agent** (a
  ghost `sm` button, lucide's `Bot` first, pressed while the panel
  shows: it opens a new chat, or hides the panel; ⌘J), then
  **History** (a ghost icon button, a popover of the chats, latest
  first, each with how long ago; choosing one opens it in the panel).
  Minimize hides the panel and keeps its tab; close takes the tab away.
  A new chat is no tab until its first message is sent: Agent opens it
  with nothing added to the bar, and shows it again with its draft.
  At most five tabs: a sixth drops the oldest.

### Command menu

**`command-menu`** — One dialog runs actions and opens pages, from the top
bar's button or `⌘K` (Ctrl+K elsewhere) on any page of a workspace.

- **The button** is the search icon in the sidebar's head, with a tooltip
  naming it and ⌘K.
- **The dialog** sits a sixth of the window down, 576 px wide at most
  (the window less 16 px a side on a phone), level 4. A search field 48 px
  high heads it, the list scrolls under it, and a foot 36 px high names
  the keys that move in it (↑ ↓, ↵, Esc).
- **What the page shows** comes first. On a post's page, a chip before the
  search text names the post (the start of its text, on `secondary`, the
  4 px radius), and the first group, "This post", holds what can be done
  with it: reschedule it, duplicate it, copy its link, show it on the
  calendar on its day, open it on each platform where it went out.
  Backspace in the empty field takes the chip and its group out until the
  menu opens again.
- **A question** ("Reschedule…") opens a page of the menu where what is
  typed is the answer: its own placeholder, and one line that says what
  Enter does ("Move to Monday, November 23, 2026 at 8:30 AM", how far off
  in muted text), or why it cannot, or what to type. Esc or Backspace in
  the empty field goes back. The move offers Undo, as the calendar's does.
- **A choice** ("Change or add tags…") opens a page of its options, which
  typing narrows; an option that is on or off has a box (✓ all, – some).
- **The list** is in groups with a small label: Create, Go to, then the
  sections (Posts, with the posts list's states: "Posts: Drafts",
  "Posts: Scheduled", "Posts: Needs approval", "Posts: Failed", "Posts:
  Partly published", "Posts: To check", a tab with its keys; Settings),
  PealAPI, Workspaces and Help. A row is 34 px: the page's icon
  (the sidebar's) at 16 px in muted text, its name, and its keys at the
  end. Only what the member's role opens is listed. The highlighted row
  takes `accent`, as a menu's does.
- **Typing** filters every group at once; the letters that matched turn
  semibold, never coloured. Nothing found says so with the text typed.

### Toasts and undo

**`toast`** — A toast says what an action did, once it is done: a white
card at the bottom right, 384 px wide at most (the window less 16 px a
side on a phone), level 4, a 16 px icon in muted text (in `destructive`
for an error), the sentence, and at most one action at its end, an
extra-small outline button. Toasts stack, the newest in front, and open
out while the pointer or focus is on them; F6 reaches the newest. They
leave after five seconds, six when they offer Undo.

- A toast with an action shows the **time it has left**: a 2 px line along
  its foot in the mark's colours, the gradient staying in place while it
  is covered from its end toward its start. It stops whenever the toast's
  time does: while the pointer or focus is on the toasts, during a swipe,
  and while the window is away. With reduced motion, there is no line.
- A change that can be taken back says so with **Undo** rather than asking
  first. Undo, or ⌘Z (Ctrl+Z) while its toast shows and focus is not in a
  field, takes it back and says so ("Post moved back to …"). What cannot
  be taken back keeps its confirmation.

### Support chat

**`support-launcher`** — Where the operator names a Crisp website, every
page of the site, the docs and the blog has a launcher at the bottom
right that opens the support chat (peal-ui's `<peal-support>`), and the
app's account menu has Support. Crisp loads only once one is pressed, or for a visitor whose cookie names
a conversation, so their replies show.

- **Its look**: on the site and the blog, the pixel bubble below; in the
  docs, lucide's `message-circle` (16 px, stroke 1.75, in
  `muted-foreground`, ink while hovered or open), replies waiting shown
  as a 6 px blue dot at its corner, in a 2 px ring of the page's
  `background`,
  as the account shows unread notifications.
- **The pixel bubble**: a 32 px square, its art a speech bubble of 12 by
  12 cells of 2 px: the mark's blue, a lavender light at its top left, a
  darker blue edge (`#2F47C9`) toward the bottom right, and three white
  dots that type, one after the other, in yellow: one wave every four
  seconds at rest, on while the pointer or focus is on it, fast while the
  chat loads. Replies waiting turn the dots yellow and show their count
  on a yellow 14 px tile at its corner (Geist Mono, 10 px, ink); its name
  says the count. With reduced motion the bubble is still.
- **On the site and the blog**: a white card, 1 px `border`, `{rounded.md}`,
  a popover's shadow, 16 px from the window's bottom. From 78 rem up it
  stands outside the page, centred in the margin between the right rail
  and the window's edge; narrower, 16 px from the right edge. While the
  consent notice asks, it hides: the notice is the one thing that floats
  without being opened. **In the docs**, the same card holding the icon,
  16 px from the corner.
- **In the app**: no launcher. The account menu (the avatar at the
  bottom bar's start) has **Support**, after Account, a `life-buoy` icon,
  which opens the chat 8 px above the bar, from its start; replies waiting
  show their count at the row's end in `brand-text`, as Notifications
  does, and the avatar's blue dot. Never offered while staff act as
  someone.
- **The window** is Crisp's, in Peal's blue (`brand`, its hover and pressed
  shades, the blue tint) and Geist, set over Crisp's variables: it opens
  8 px above the launcher, their right edges in line (in the app, above
  the account menu), and fills the
  screen on a phone. Crisp's own round button never shows: the launcher
  opens and closes the chat, and, as a popover, Escape or a press outside
  the window closes it.

### Lists: filters and display

Every list, grid or calendar narrows and orders what it shows the same
way, so a person who learns one screen knows them all.

- **`list-toolbar`**, under the page's title: its **views** on the left,
  as **`view-tab-default`** / **`view-tab-selected`** tabs ("All · Drafts
  · Scheduled · Needs approval"; selected is a lift to `accent`), then at
  the end **Filter**, **Display** and the page's own actions.
- **`list-tool-button`** — Filter and Display: small outline icon buttons
  (30 px, `{rounded.md}`) with a tooltip naming them and their key, the
  border and icon blue while what they open narrows or orders the list.
- **Filter** (F) opens a menu (level 3, 288 px): a search field, then the
  list's properties (Status, Channel, Tag…), each opening a page of its
  values. Typing searches every value at once ("Channel › Client A"),
  matching the text it contains. A value chosen becomes a
  **`filter-chip`** in a row under the toolbar: the property with its
  icon, "is", the value, and × to take it off, cut by hairlines, 28 px
  high, `{rounded.sm}`; pressing the value opens the menu on that property
  to change it. After the chips, **Clear** takes them all off. A property
  holds one value at a time, unless the screen can show several: then
  its values have checkboxes, the menu stays open while they are ticked,
  and the chip says "is any of" with the names joined ("Tag is any of
  Launch, News"). Properties add up.
- **Display** opens a small panel (level 3, 288 px, 12 px inside):
  **Ordering** (what the list is sorted by) with a button that turns its
  direction, and where a screen has them, grouping and its other views
  (list, calendar).
- **`period-menu`** — Wherever a screen shows a span of days (usage),
  **Period** chooses it (an analytics widget chooses its own in its
  Filter, see Analytics board): a small outline button (30 px)
  with a calendar icon and the span's name ("Last 30 days"), opening a
  menu (level 3) of the spans the screen offers, the chosen one ticked. It
  sits in the page's actions, or at the end of the header of the card it
  governs. It lives in the address as `?period=` and a number of days.
- **Time zone** — A screen that places posts at times (Calendar) says
  once which zone it reads them in: one line in `{typography.caption}`,
  muted, at the end of the content's first row, beside the dates the
  calendar names: "Times are in your time zone, Europe/Paris." Analytics
  says nothing of it, nor how often counts are read: its days are the
  reader's, as every date in the app is. The zone is
  the browser's, so the line appears once the page has hydrated. It is
  not a description, and never sits in the panel's header.
- What a list shows lives in the page's **address**: a reload, the back
  button or a link shows the same list. Defaults are left out of it, and
  changing it never scrolls the page.
- The same words everywhere: a property is named in the singular
  (Channel, Tag), a value as the app names it elsewhere, a time range is
  a **Period** ("Last 30 days"), taking every filter off is **Clear**,
  and the next page of a list is **Show more**.
- A list the filters leave empty says so, with **Clear**.

### Lists: choosing several

- A list whose items can be acted on together has a **focused row**, the
  one the keys act on: the pointer moves it, and so do J and K (or ↓ and
  ↑). It takes a `muted` background, a chosen one keeps its tint.
- Each row has a **checkbox** at its start, for members whose role
  allows one such action at least, shown on the focused row and on the
  chosen ones only (always on a touch screen). A click on it chooses the
  row; Shift with a click anywhere on a row chooses every row from the
  last one clicked (or lets them go, as the row clicked goes) and opens
  nothing. X chooses the focused row, Shift with J or K grows the choice
  up or down, ⌘A chooses every listed row, Enter or O opens the focused
  one. A chosen row is tinted `brand-tint`, blue being selection's
  colour.
- **`selection-bar`** — While something is chosen: a small white pill
  (40 px high, `{rounded.pill}`, level 4) that sticks 24 px above the
  window's foot, centred under the list. It holds three things only: the
  count in muted text ("3 selected"), **⌘ Actions** (a `secondary` round
  button) and a round close button that lets go. The actions never sit in
  the bar. It is one tab stop, its buttons reached with the arrow keys.
- **Actions** opens the command menu on the choice: a chip names it ("3
  posts", Backspace takes it out) and the first group holds the actions,
  each with its key, which works on the list too while something is
  chosen. An action with options (tags) opens a page of them, each with a
  box that says whether all the chosen items have it (✓), some (–) or
  none; choosing one that all have takes it off them all, any other puts
  it on those without it, and a "Remove all" line comes first. ⌘K opens
  the same menu. Esc goes back a page, then closes the menu, then lets
  go; changing the list's filters lets go. An action keeps the choice, so
  another can follow.
- Each action reaches the chosen items it applies to, and its label says
  so when that is not all of them ("Back to draft (2 of 3)"); an action
  none of them allows is left out. What can be taken back offers Undo
  (a tag's change, which puts back each item's own tags); what cannot
  asks first, naming how many ("Cancel 3 posts?"). One toast says how it
  went, with how many could not be done when some could not.
- On the posts list: **Change or add tags…** (L), **Approve** (V,
  awaiting approval, for members who may approve; it asks first, as an
  approval cannot be taken back), **Request changes** (R, the same posts;
  a dialog asks for the one comment their authors are told), **Back to
  draft** (U, scheduled or awaiting approval) and **Cancel** (⇧⌫, not yet
  out).

### Menus, dialogs and sheets

**`menu`** — Menus, selects' lists and popovers: white, level 3,
`{rounded.md}`, 4 px around rows of 32 px, the highlighted row on
`accent`.

**`dialog`** — White, level 4, `{rounded.lg}`, 24 px inside, never taller
than the window (its body scrolls): check each at 320 and 375 px wide, in
English and French. A sheet slides from its side, 384 px wide at most.

### Empty states

**`empty-state`** — When a list, a page or a pane has nothing to show, it
says so in its centre, across and down the space the panel leaves under
its toolbar:

- A **`pixel-icon`**: the page's own icon (the sidebar's lucide icon)
  drawn as still pixel art, as the site draws its tiles (peal-ui's
  `PixelFigure`, 5 px cells): 80 px square, in the blue and lavender
  tints with blue on the brightest cells. It never moves, and screen
  readers skip it.
- A **title**, 15 px, 600 ("No posts yet", "No matching posts").
- Where it helps, one or two lines in muted text, 28 rem wide at most,
  saying what will appear and how, keys shown as keys.
- At most two buttons: the next step (the primary button) and one
  outline ("Documentation").
- When filters hide what the list holds, the title says "No matching
  posts", and a bordered strip under it says how many are hidden ("**12
  posts** hidden by the filters") with **Clear** at its end.
- A pane with nothing chosen (a reading pane) shows the icon and one muted
  line ("No conversation selected").

No other illustration, no joke, no exclamation mark.

### Split view

A page whose items are read one after another, such as the Inbox, lists
them beside the one open, so the list stays where it was.

- **`split-list`** — The panel's first pane, 384 px wide on a desktop,
  with a hairline on its right. The panel's 48 px header sits on top of
  it: the page's name, and its Filter and Display at the end. Under
  the header come its views as tabs and the filter chips, then the rows.
- **`split-row`** — One line naming the item, ellipsed, with the day of
  its latest news at its end in `muted-foreground` (12 px), and one line of
  counts under it. A 6 px `brand` dot before the name while something in
  it waits. The whole row is the link (10 px by 16 px inside); the open
  one takes `accent`, hovered ones `muted`. Rows are cut by hairlines,
  with no card around them.
- **`split-detail`** — The rest of the panel: the item open, under a
  48 px header of its own that names it (`h2`; the page keeps its `h1`)
  with its actions at the end. With nothing open it shows an empty state
  ("Nothing open"), centred.
- **`split-thread`** — An item that is a conversation (a post's comments,
  a location's reviews, a direct-message conversation) reads as one. On top, a short summary above a hairline: where and since
  when, then in 12 px muted text what waits and why nothing more comes,
  and the ways out. Then each message flat, never in a card: a 24 px
  avatar, the author (500) with their handle, a 12 px muted line with
  when and its state (the `brand` dot while it waits, a small icon
  otherwise), its text, and its actions as `xs` ghost buttons, Reply
  first. What answered it hangs under it behind a 2 px line at its
  start. One composer, sticky at the pane's foot, answers the message
  that Reply chose (the oldest still waiting until then) and names whom.
  A direct-message conversation is answered whole: its messages come
  oldest first, with no Reply on each, and above its composer a 12 px
  muted line says until when the platform takes an answer, or why the
  composer is gone.
- The address names the item open, and the list's views and filters
  follow it, so a link opens both. On a phone the list fills the panel;
  an item opens alone under the header, with a way back at its header's
  start.

### Analytics board

Analytics is a board of widgets the person arranges, each showing one
thing over a period of its own.

- **`widget-board`** — A grid four up from 1280 px, two up from 640
  px, one on a phone, 24 px apart, its rows 320 px high. A widget spans
  one to four columns and one or two rows (two columns at most from 640
  px, one on a phone); each kind starts at its own width and reads in
  no fewer columns than its least (a chart over days, two). The board
  keeps the person's order and leaves a gap rather than reorder what
  they placed. The board
  is the person's, kept in their browser for each workspace; a new
  workspace starts with the default one, the few that matter most
  (Followers, Top posts, Engagement, and Engagement over time two rows
  high), and **Reset layout** brings it back.
- **`widget`** — A `card` (24 px inside). Its header holds the name
  (`card-title`) with one muted line under it, the period and, where it
  shows one, the channel ("This year · @peal.social"), and at its end two
  buttons: **Filter**, the list's Filter menu for this widget (a
  `list-tool-button`, its border and icon blue while the widget shows
  other than its own; its menu searches the widget's properties, Period
  and, where it may show one, Channel, each a page of its values, a
  channel with its platform's mark) and the ghost **…**
  (Duplicate, Rename, then Remove in destructive text). Remove and Reset layout say so in a toast with
  **Undo**. A grip just outside the card's start edge, beside its name
  (no border, `muted-foreground`), shown on hover and focus, picks it
  up: it follows the pointer in any direction, lifted (2 %
  larger, a deep shadow), while the others glide aside and a dashed
  `muted` slot shows where it lands; let go, it settles into the slot; Space picks it up from the keyboard, the arrows carry
  it and Space puts it down. Every edge and corner resizes it: a pill
  centred on each edge, shown on hover and focus, and the corners under
  the pointer alone; pulled from its start or top, its other side stays
  put: the card follows the pointer to the pixel, over its
  neighbours, with a 2 px `brand` ring and a shadow, what it shows
  blurred and its chart stretching; let go, it snaps to whole columns
  and rows and glides there while the others glide to their new places.
  Every move of the board takes one curve, quick to start and long to
  settle (320 ms, `cubic-bezier(0.22, 1, 0.36, 1)`). Focused, the end and bottom pills take the
  arrow keys of their edge, the card's two tab stops for its size. Nothing glides for a reader who asked for less motion.
- Under the header: the headline number (`headline`, tabular), one muted
  line with its change against the days before or what it gained, then
  one chart, the one that fits what the widget shows, filling the card
  at any size, with no second view: a line on a faint `brand` area to
  the card's edges for a count that moves (followers between their
  lowest and highest, engagement and reach from zero); thin `brand`
  columns for a count each day stands on (views); a ring of the
  platforms with the total in it (posts); bars by platform (impressions,
  clicks, saves); one bar cut into each platform's share (platforms);
  stacked columns in one blue from deep to faint with the seven-day
  average as an ink line over them (engagement over time); quiet rows
  with the platform's mark (top posts, channels). The days under a chart
  grow from three to nine as it widens; the pointer shows a day's
  figures in a tooltip. Charts are `aria-hidden`, their figures a table
  screen readers take. A widget loading shows a faint chart in `muted`.
  A number a platform does not give is a dash with "Not given by the
  platform" under it, never zero.
- **Add widgets**, a small ghost button in the page's actions, opens a
  sheet from the right: a search field, then the kinds by section
  (Suggestions, Audience, Posts, Files), each a card with a drawing of
  what it shows (`brand` on `card`), its name and one line; choosing
  one adds it at the board's end with a toast. **Reset layout** sits at
  the sheet's foot. An empty board is the empty state, with **Add
  widgets**.

### Settings

A workspace's Settings is one section of the sidebar, its pages sorted by
concern under small group labels, in this order:

- **Personal**: the person's own pages, the same in every workspace:
  Profile, Preferences, Notifications, Email notifications, Security and
  access, Agent.
- **Publishing**: Tags, Signatures, Channel sets, Direct messages,
  Assistant.
- **Automations**: Queues, Repeating posts, Follow-ups, Comment replies,
  Feeds.
- **Administration**: Workspace, Members (inviting and the invitations
  waiting are part of it), Security, Billing.

Each page is a column 48 rem wide at most, centred in the panel, 24 px
from its header. The column holds **sections** 32 px apart: a heading
(`card-title`, the section's `h2`) with one muted line under it where it
helps and, at its end, what acts on the whole section, then 12 px under
it one card of `settings-row`s. The page's first section may have no
heading. A list the section holds (members, sessions, tags) sits in the
card as rows, with each row's actions at its end; a form that is more than
one field (a password, an invitation, a new tag) sits in the card on its
own, 16 px inside. An empty card says so in one muted row.

A setting applies as soon as it changes, with a toast saying so: a switch
or a select at once, text once the person leaves the field or presses
Enter (Escape puts the saved text back). Only forms that create
something, or ask for a password, keep a button. What cannot be undone
comes last, under **Danger zone**, its button outline in the row; the
destructive button is in its confirmation only.

### Pages

- **Empty states** say what will appear and give the one next step (see
  Empty states).
- **Errors** name the cause and carry the fix beside it (crop, reconnect,
  review).
- **Consent.** A question Peal must ask, such as whether the app may
  link what someone does to their account and record their sessions, is
  a card in the page's content, never a bar across the frame, a dialog or
  anything that floats. Its two answers are two buttons of the same
  variant and size (`outline`), side by side, so refusing is as easy as
  accepting. The card leaves once answered, and the Preferences page
  keeps the answer, where it can be changed. The site, the docs and the blog,
  where a visitor has no page of their own to be asked on, ask with the
  consent notice (see [Site](#site)).
- **Home** holds, under the consent card, the headline (two lines, the
  second muted) and its cards: connecting channels, connecting an
  assistant, and the quickstart.
- The **setup card**, a new workspace's second setup step (the frame's
  `setup`), is one card, never a dialog or a bar. A member who may not
  connect channels goes to the workspace's home instead. It has three
  states:
  - **Choose.** Its title ("Set up your channels") and one muted line,
    then one bordered list (as `list`) of the platforms the server signs
    in to, each row its mark (16 px tile), its name and a checkbox at its
    end, none ticked: Peal cannot know which accounts someone has. A row
    that needs a word before its sign-in shows its field under the name
    once ticked (Mastodon's server, Bluesky's handle, optional). A row
    the plan refuses (X without a payment method) is disabled, its
    reason in muted text. Under the list, one muted line on the cost,
    from the rate card and never a typed figure (nothing where billing
    is off), then **Connect N platforms** (primary), **Skip for now**
    (outline), and a link to New channel for websites and chats. Its
    line under the title says each platform names the account it will
    connect, to check when the browser is signed in to several: Peal
    cannot see or choose it.
  - **Running.** The same rows, each with what it came to: connected
    with its handles, failed with the reason (`destructive` text, the
    row untinted), or waiting. The sign-ins happen in a tab of their own,
    opened by **Connect** or **Continue**, while the step stays open in
    the first tab and follows each outcome as it lands: a platform's page
    that keeps its tab (a help article, an error, a login abandoned, an
    account awaiting approval) never takes Peal away. In that tab, Peal
    goes from one platform's sign-in to the next by itself, naming the
    next on the callback page before it leaves ("@peal is connected.
    Continuing to LinkedIn…"), and the tab closes once the run ends or
    stops. A browser that refuses the tab runs the sign-ins in the step's
    own tab instead. Anything that stops a run (a failure, a refusal, a
    cancelled choice, the Back button) leaves the step with **Continue
    with LinkedIn**
    (primary), **Skip LinkedIn** and **Stop** (outline): a platform
    the member is not signed in to, or signed in to as the wrong
    account, is passed without ending the run; **Stop** ends it and goes
    to the workspace's home. The step never leaves for a platform by
    itself, and its buttons wait while a sign-in starts.
  - **Done.** One line on how many accounts were connected and on what
    failed, then that a wrong account is disconnected from Channels;
    **Write a post** (primary) and **Go to Home** (outline). When none
    was, **Start over** (primary), which brings back Choose, and **Go to
    Home**.
- **The composer** writes one text with a tab per channel, counts each
  platform's limit, and shows a preview beside it.
- **Channels** is a list like any other: views (All, Needs reconnecting,
  Turned off, with how many each holds), Filter by Platform, Type and
  Feature, Display ordering by date connected (the default), name,
  platform or status, and each row the account's avatar with its
  platform's mark (16 px tile) at its corner. The toolbar stays over the
  empty state, as on every list. A row wears a status badge only when
  the channel does not post. Connecting is never on the list: **New
  channel** in the header, and **Create a channel** as the empty state's
  primary button (each view's own text, with **Documentation** to its
  section of the channels guide), open a page of its own, a catalogue
  of the platforms the server connects (types as views, a search,
  Filter by Feature) in tiles three up, each its mark on a
  36 px tile, its name, its type and its features as outline badges.
  A tile opens that platform's form alone, a page nested under New
  channel (`…/channels/new/mastodon`), which the breadcrumb names.
- **A date in words.** Above the date and time pickers, "Type when" reads
  a date as people say it, in English or in French ("tomorrow 9am",
  "vendredi 10h30", "in 3 days", "27 nov"), on the schedule's clock. Under
  the field, in muted text, it says the date it read in full and how far
  off ("Friday, November 20, 2026 at 10:00 AM, in 19 hours"), that it
  has passed, or what to try; Enter sets the pickers, which stay. It never
  guesses: a word it does not understand names nothing. A weekday alone is
  the coming one; "next friday" and "vendredi prochain" are the week after
  it.
- **Hosted pages** (a connect link's page, which a partner's customers
  open) are one white card on `background`, headed by who asks: the
  partner's logo and name. A partner's accent colour is a 4 px line along
  the card's top, above the logo, and nothing else: never text, an icon,
  a fill or a button, which keep Peal's colours. The server takes only
  `#RRGGBB` with at least 3:1 contrast against `card` and `background`
  (WCAG's bar for a line that must be seen), so lavender- or yellow-like
  colours are refused.

### Code block

**`code-block`** — peal-ui's `CodeBlock`: a bordered panel,
`{rounded.lg}`, with a header bar, then the code on `muted` in Geist Mono
13 px, coloured as [Code](#code) says (the site's details are under Site).

## Brand field

The brand field is Peal's one gradient surface: the mark's colours
glowing on a deep blue, drawn exactly as Peal's social banners are.
peal-ui's `BrandField` renders it, from the `--field-*` tokens. The only
other gradient is a line, the mark's colours across it (blue, lavender at
70%, yellow): the pricing slider's fill (see Account calculator) and a
toast's time left (see Toasts and undo).

**Where.** Only in the art area of a site menu's preview card, and on
covers and social images (blog covers, Open Graph images, the social
banners). Never in the app or the docs, and never twice on one screen. The
site's pages themselves stay on the light grid: their hero and closing band
show the field's glows as pixels instead (the pixel glow, see
[Site](#site)).

**On it.** White text only (`#FFFFFF`), over the base and the blue glow
(5:1 or better there), never over the lavender or yellow glows, which sit
at the corners for that reason; then the rails and their captions. A
button on it is `button-inverse`.

The base is `radial-gradient(120% 140% at 50% 50%, #1E2D8C 0%, #16206A 60%, #0F1650 100%)`.
Five blurred ellipses glow on it. Their sizes and blur are fractions of
`--m`, the field's width or 2.2 times its height, whichever is larger; their
centres are a percentage of the field's width and height:

| Glow          | Token           | Colour    | Width | Height | Centre   | Opacity | Blur | Blend  |
| ------------- | --------------- | --------- | ----- | ------ | -------- | ------- | ---- | ------ |
| Blue          | `blue`          | `#415EEE` | 0.55  | 0.32   | 50% 55%  | 0.9     | 0.07 | normal |
| Lavender      | `lavender`      | `#B9A6FF` | 0.42  | 0.26   | 92% 0%   | 0.85    | 0.07 | screen |
| Deep lavender | `lavender-deep` | `#8E86FA` | 0.3   | 0.2    | 6% 8%    | 0.55    | 0.07 | screen |
| Halo          | `halo`          | `#B9A6FF` | 0.42  | 0.26   | 84% 104% | 0.7     | 0.07 | screen |
| Yellow        | `sun`           | `#FFCA00` | 0.24  | 0.13   | 87% 108% | 1       | 0.05 | normal |

Over them, grain at .32 in `soft-light`: fractal noise (`feTurbulence`,
base frequency 1.1, three octaves), desaturated.

**Rails.** Two vertical and two horizontal drafting lines cross the whole
field, 1 px wide. Rails are white at 16%. Where two cross, a crosshair tick
(±5 px) marks the joint: Ticks are white at 55%. On the site, the vertical
rails stand on the page's own rails (see [Site](#site)); elsewhere at 13%
and 87% of the width, and the horizontal ones at 14% and 86% of the
height.

**Captions.** Small Geist Mono text just under the lower rail, inside the
vertical ones: Captions are white at 60%, lowercase, `0.04em`, 12 px. One
on each side at most, such as "peal.social" and "fair source ·
self-hostable".

## Docs

The docs are Blume, dressed in the same tokens: `theme.css` maps Blume's
`--blume-*` variables onto peal-ui's, so the page, borders, muted text, code
blocks and radius are the app's, and no colour is written there twice.

- **Tabs**, across the top: Get started, Guides (running a workspace, the
  app's PealCreative), Platforms, Developers (building on the API, the
  app's PealAPI), the API reference and Self-hosting. Each page belongs to one.
- **Sidebar groups** take the names and the order of the app's own
  navigation, so a page and the screen it explains are called the same:
  Guides has Channels, Posts, Analytics, Inbox, Ads, Automations and
  Settings as labelled groups (Blume's `flat` display). Elsewhere a section with pages of its own drills
  down, as the app's sidebar does (Blume's `page` display).
- **Figures** a platform or a plan sets (text limits, prices) come from the
  contract as Blume variables, never typed into a page.
- **One page, one task**, for one reader. Where the app, the API, the
  command line and MCP do the same thing, one block of tabbed samples and a
  link to the Developers page replace a section for each.
- **Platforms** are shown by their own marks, from the same files as the
  app's, never redrawn.
- **Consent notice.** As the site's, at the bottom right, with a **Cookie
  settings** row at the foot of every page.

## Site

The marketing site is drawn on a blueprint: the same tokens as the app, on
`background`, with its structure left visible.

- **Rails.** The content column, 72 rem (1152 px) wide at most with 16 px
  of gutter on a phone, has a vertical rail on each side in `border`,
  from the header to the footer. Sections are separated by full-width
  rules in `border`; where a rule meets a rail, a crosshair tick (±5 px) in
  `input` marks the joint. Content sits in bordered cells, never in
  floating cards.
- **Header**, 56 px, on `background` with a rule under it: the mark and
  "Peal" on the left; Products, Platforms and Resources (each opening a
  mega menu; the blog is Resources' first row), Pricing and Docs in the
  middle; on the right the
  GitHub mark with the star count (Geist Mono, hidden when unknown), a
  vertical divider, the Discord mark alone (an icon-only button with its
  `aria-label`), Log in (a ghost button) and Get started (the primary
  button). Below 1024 px the middle and right collapse into a menu button
  that opens a drawer from the right, with the same items.
- **Mega menu.** One floating panel (the shadow of a popover), white, with
  the 8 px radius. Its links are grouped under a small label (12 px,
  muted), in bordered cells side by side. A row is a 16 px lucide icon in
  a bordered 32 px tile, a title (14 px, 500) and a one-line description
  (13 px, muted), with the `accent` hover; a row that names a brand, such
  as a platform, has its 16 px mark in the same tile and its name alone.
  A group's label may name a product, in ink and 500, followed by whom
  it is for in muted text: Products has "PealCreative for marketing teams"
  and "PealAPI for developers and agents".
  Cells side by side are as tall as each other; cells stacked in one
  column share its height, the last one taking what is left. A featured card
  closes the panel on the right, as tall as its content, never stretched
  to the groups: a `muted` cell with a caption, a picture where one says
  something (brands' marks in 40 px bordered tiles), a title, one line and
  an arrow, linking to what it features.
- **Menu preview.** A mega menu may close on a preview card instead of a
  featured card (all three do): a `muted` cell holding a brand field
  without rails, as tall as the rows beside it, with pixel art, then an
  intro: a headline (a sentence, 15 px, 600) and a line or two (13 px,
  muted) about what the page holds, written for the card and never the
  row's own description. The card is not a link and takes no hover or
  focus; screen readers skip it, since the rows are the links. Its height
  stays that of its longest intro, so it never jumps between rows. The art
  is the icon of the row the pointer rests on or focus is in, rasterised
  onto 5 px cells in blue, lavender and white by coverage, Bayer-dithered
  and brighter toward the top, with yellow on the top rows; with no row
  previewed, it shows the card's own mark and intro. Moving from one row
  to another dissolves the pixels in about 280 ms, and a scanline sweeps
  the art while the menu is open; with reduced motion, the art swaps at
  once and nothing sweeps. A menu whose rows are all of a kind, such as
  Platforms, has one preview for all of them that does not change with the
  row; since it repeats no row, screen readers read it (its art aside),
  and it may hold one small text link under its intro. The drawer has no
  preview.
- **Platforms menu.** Every platform a channel connects to and every ad
  network, from the contract's lists, under Social (a wide cell of two
  columns), then Chat, Ads and Blog stacked in one column beside it, each
  row linking to the platform's docs page; both kinds of WordPress site
  are one entry. Its preview is one post fanning out to many networks:
  the mark in the centre, joined by spokes to nodes around it. A small
  text link with an arrow under the preview's intro compares every
  platform, after the rows in tab order. The panel fits from 1024 px up.
- **Marks on the site.** Brands' marks (platforms, GitHub, Discord) come
  from simple-icons, at the version the workspace pins, in `currentColor`:
  ink, or muted text in the drawer, never the brand's colour. LinkedIn,
  Slack and Google Business Profile, missing from simple-icons, take
  peal-ui's brand marks the same way: their owners' one-colour marks,
  and for Google Business Profile, which Google publishes in colour only,
  a one-colour mark made from Google's file alone (its outline with its
  "G" cut out).
- **Section counter.** Every section of a page below its hero opens with
  its number and name in Geist Mono, 12 px, muted, `0.04em`: `[ 01 / 03 ]
  · Product`. Sections are counted in order, and the total is the page's.
- **Section opener.** Below its counter, a section opens on a band with
  a faint pixel field behind it (5 px cells in the blue and lavender
  tints, `#E8ECFD` and `#EDE7FF`, where smooth noise rises, thinning
  toward the middle, still), and, centred, an eyebrow in Geist Mono,
  12 px, muted, `// [icon] Label \\`, the section headline with its
  second sentence muted, and a lead. No word of the headline is coloured.
- **Feature cells.** Bordered cells in two columns on the rails: a 16 px
  icon and a label (13 px, muted), a paragraph at the lead's size whose
  first phrase is ink and 600 and the rest muted, an optional link in
  `brand-text` with a chevron, and an illustration. A cell may span both
  columns, its words centred and its illustration at most 28 rem wide.
- **Illustrations** are drawn from Peal's own UI, never pictures of
  another site: a mock window (a bar with three outlined dots and the
  app's address in a mono chip, then rows of a label, a mono value and a
  chip), a line of mono chips such as `:: Publishing…` in the tint and
  text of the post states (scheduled, published, needs approval), still
  pixel art of an icon, or the repository's card (its mark, name and
  star count, then the pull requests merged last, from GitHub at build
  time, without work-package codes).
- **Code block.** peal-ui's `CodeBlock`: a bordered panel with a header
  bar, then the code on `muted` in Geist Mono 13 px, coloured as
  [Code](#code) says and highlighted at build time, so no highlighter
  reaches the browser. The header holds the language switcher and a
  ghost Copy button, which copies the plain source and says "Copied" to
  screen readers too. The switcher lists curl, the CLI and the eight SDKs,
  each with its mark (lucide's terminal for the CLI). It is ui-sdk's tabs
  once the block is 60 rem wide and ui-sdk's select below that, since ten
  tabs do not fit on one line any narrower. A block with one language shows
  its mark and caption in place of the switcher. Every block on the page
  shows the language picked last, and the reader's next visit opens on it.
  A request may have its response beside it, from 48 rem of block width,
  or under it below that. Each pane has a mono caption (the file's name,
  `201 Created`). Line numbers are optional and stay put while the code
  scrolls. A long line scrolls sideways inside its pane, above a thin
  scrollbar, and never wraps: the code keeps the shape it is copied in,
  and the page never scrolls sideways. From 48 rem, a block keeps the
  height of its longest language, so switching moves nothing. The
  requests are the docs' own, the SDKs' calls are their generated
  methods, the responses use the contract's shapes, and every id is
  obviously made up.
- **Tiles.** Bordered cells in rows of four (two on a phone), under a
  mono group label: a 36 px bordered tile with an icon or a brand's mark,
  an arrow pointing out, a title (15 px, 600) and an optional line.
- **Two products.** Peal is presented as two products on one workspace,
  spelled `PealCreative` (for marketing teams) and `PealAPI` (for
  developers and agents): the two sides of the app's mode switch (see
  [The frame](#the-frame)). A product's name is set as one word, in the
  text's own colour, never as a logo.
- **Announcement bar.** A line the whole site must say, above every page's header:
  a thin ink bar across the page, 13 px text in `background`, centred,
  after a 5 px square in yellow, then a link with an arrow to read more.
  It cannot be dismissed, and the site removes it once it no longer holds;
  no page repeats it.
- **Consent notice.** The one question the site, the docs and the blog
  ask a visitor: whether Peal may keep a cookie to follow their visits.
  It is peal-ui's `<peal-consent>`, the same on all three. A white card
  (`card`, 1 px `border`, the 6 px radius, the shadow of a popover)
  fixed to the bottom right of the window, 16 px from its edges, 30 rem
  wide at most and about 230 px tall; from 1184 px up its right edge
  stands on the page's right rail. It is the only thing on the site that floats without being
  opened (the support launcher hides while it asks), and it never dims or blocks the page: no backdrop, no focus
  trap, and it takes no focus when it appears. Inside, the pixel cookie
  is the anchor, on the left with its readout under it; beside it a
  title (15 px, 600), three short sentences (14 px: what is counted
  without a cookie, what a cookie adds and the account link, how long it
  lasts and where to change one's mind) ending on a link to the privacy
  policy in `brand-text`, and under them the two answers as two
  `outline` buttons of the same size, side by side and equally wide,
  Allow first, as the app's consent card has them. Neither is the primary button and neither has focus. Below
  640 px it is a sheet along the bottom edge, full width, with a top
  border and no radius, at most half the window's height (its text
  scrolls above the answers), and the page gains that much padding at
  its foot so the footer stays reachable. Once answered it leaves, and
  **Cookie settings** in the footer (a row at the foot of the docs)
  opens it again, with the answer, its date and a ghost Close button in
  its corner;
  focus then goes to its title and returns to the link on closing. A
  browser that sends Do Not Track or Global Privacy Control is never
  asked.
  Its art is the pixel cookie: a 153 px square of 17 by 17 cells of
  9 px holding a round cookie, its dough in the blue and lavender tints
  (`#E8ECFD`, `#EDE7FF`), Bayer-dithered, its rim in lavender with a
  baked edge inside it toward the bottom right (`#D5C9FF`, the pixel
  glow's light lavender), and seven
  chips in the mark's blue, lavender and yellow that twinkle each on its
  own beat, as the pixel glow's cells do. Under it a readout in Geist
  Mono, 12 px, muted, says what each answer means for the one cookie
  that follows a visitor: `cookie: ?` at rest, `cookie: 183 d` while the
  pointer or focus is on Allow, `cookie: none` on the other button. On Allow the chips slide, cell by
  cell in 280 ms, into the mark's six facets at the cookie's centre; on
  the other button a bite dissolves from its top right and three crumbs
  fall two cells. Answering plays an exit of the same length either
  way, 700 ms: allowed, the cookie folds into one yellow pixel that
  drops off the art's foot, toward the footer where the answer can be
  changed, with a burst of pixels as the pricing slider's; refused, its
  cells crumble and fall, and a dithered scanline sweeps the empty
  square once.
  The card sinks 8 px and fades over the last 200 ms of either exit. No
  answer is rewarded more than the other, and nothing is coloured as
  right or wrong. It appears by baking in: its cells light in a scatter
  over 400 ms while the card rises 8 px. Its chips twinkle at 24 frames
  a second, only while on screen; its moves play at the screen's own
  rate, so their easing stays smooth. With reduced motion the cookie is
  still, the readout alone changes, and an answer removes the card at
  once. On a phone the art is a still 35 px cookie beside the title, and
  the card alone leaves, after the same 700 ms. Screen readers skip the
  art and the readout, and hear "Saved" once an answer is written.
- **Hero.** On the page's background and grid: the headline (one plain
  claim, no slogan), the primary and outline buttons
  on the left, a lead of two short sentences in muted text on the right,
  then the stage. Behind it, the pixel glow in its hero layout.
- **Pixel glow.** The brand field's glows drawn in pixels on the page's
  own background (peal-ui's `PixelGlow`): blue, lavender and yellow,
  where the banners place them, rasterised onto 5 px cells and
  Bayer-dithered as the menu art is, each glow a strong tone at its heart,
  a middle one and a tint at its edge, never fully solid, fading to the
  plain page before any text. It lives as a fire does: its texture
  drifts slowly, each cell twinkles on its own beat so the edges shimmer,
  and a blurred copy under the pixels makes them glow; 24 frames a
  second, only while on screen, and still with reduced motion. Its
  `band` layout frames centred text; its `hero` layout keeps the top
  left, where the headline is, clear.
- **Hero stage.** Under the home page's headline (left, with its
  buttons) and lead (right), one bordered `background` panel:
  ui-sdk's tabs as a segmented switch across its top, on `muted`, one
  segment per product with the mark in a 20 px tile (white for
  PealCreative, ink for PealAPI, as the app's switch draws its modes); the
  selected segment is `card` with the switch's shadow. Its panel holds
  the product's demo: for PealCreative, the composer (one post, a tab per
  channel, each platform's count against its limit from the contract, a
  preview beside it), for PealAPI a code block with line numbers, the
  request beside its response. Under the demo, a row of chips, one per
  feature of the selected product (a 14 px icon, its name
  and an arrow pointing out, 4 px radius, bordered), each linking to its
  docs page. Below 768 px the composer's preview goes under its text.
- **Two platforms panel.** Under a section opener, the two products in
  two bordered cells (the name, 15 px, 600, then a line at the lead's
  size, muted), then one wide cell on `muted` holding a page of each side
  of the app next to each other (stacked below 1024 px): the frame
  drawn small as The frame draws it, with no bar across the top: on
  `background`, a sidebar of 176 px (its head with the workspace
  switcher, Search and New post, the mode switch, the mode's groups,
  Settings at its foot), the page in a white panel inset 6 px from the
  mock's top and right edges under its 48 px header (the page's name, and
  its actions where the page has some), the content in white cards
  (PealCreative's calendar; PealAPI's keys and webhook deliveries), then a
  36 px bottom bar with the account's round avatar at its start and Help
  at its end. Below 640 px the sidebar folds away, the panel fills the
  width and the switch moves into its header, where the app has its menu
  button. The pages show only what the app has, with made-up content.
- **Product opening.** A product's section opens on the faint pixel
  field, left-aligned: the eyebrow with the product's name, the section
  headline and an outline button to its docs on the left, the lead on the
  right, level with the button. On a phone: headline, lead, button.
- **Product bento.** Under PealCreative's opening: two feature cells side
  by side, each with a mock from the app (the composer's previews, one
  row per platform with its count and chip; the page a reviewer opens
  from a review link), then four tiles in a row (two on a phone), each
  still pixel art of its icon, the icon and a title (15 px, 600) and a
  line, linking to its docs page.
- **Product rows.** Under PealAPI's opening: one bordered row per part,
  its title (an icon, 15 px, 600), a paragraph and a link to its docs
  page on the left (5 of 12 columns), and on the right its code (a code
  block: the publishing request in every language, the others in one),
  its tiles (the SDKs' marks in bordered cells, four to a row, two on a
  phone) or a mock from the app (a connect link's page). Stacked below
  768 px.
- **Pricing page.** An opening as a section opener's, centred over the
  pixel glow: the `// [scale] Pricing \\` eyebrow, the headline with its
  muted second sentence (the free accounts), a lead. Then the account
  calculator across the column, between rules; then the rate card, and
  the closing band. Figures in tabular numbers, excluding VAT; one muted
  line after the rate card's last group says French VAT applies, at its
  rate, with a link to the terms. Every figure comes from the rate card.
- **Account calculator** (peal-ui's `AccountPricer`). The count, large
  and typed in place, labelled in mono above it, between outline − and +
  icon buttons, each moving one account; under it ui-sdk's slider: a
  6 px `border` track whose fill is the mark's colours across the whole
  track (blue, lavender at 70%, yellow), uncovered up to the count, a
  24 px round thumb in `background` ringed in blue (a little larger
  under the pointer, larger still while held), and over the thumb an
  ink tag with the count and its band's price ("150 accounts · $1 each
  a month"). Each band after the first starts at a stop of two by two
  5 px pixels on the track (yellow and lavender on top, blue below)
  once passed, `border` before; under the track, each band's range and
  price in mono, the band the count is in on `brand-tint`. The bands
  share the track by weight, not by count, so the first accounts are as
  easy to pick as the thousandth; the open band runs on a logarithmic
  scale to the slider's end (10,000), and a count typed past it rests
  the thumb there: the count has no limit. The arrow keys move one
  account and Page Up and Down ten.
  The fill and the thumb glide (300 ms, easing out) to a count typed,
  stepped or keyed, and follow the pointer at once while it drags.
  Crossing into another band throws a burst of pixels off the thumb, in
  blue, lavender and yellow, and the tag's price fades in anew. The
  month's figures count to their new value in about 260 ms. With reduced
  motion, nothing glides, bursts or counts; a screen reader hears only
  where the figures land. Then three cells, Peal Cloud, Enterprise and
  Self-hosted, sharing four rows on a subgrid (head, price, button, a
  list under a rule), so each part lines up across them: Peal Cloud's
  month (the total at 40 px with "a month · excl. VAT", the average per
  account, the primary button, what every account includes), Enterprise
  ("Custom", an outline "Talk to sales" that writes to Peal's address,
  what it adds) and Self-hosted (free, an outline button to the guide,
  what it gives).
- **Rate card** (peal-ui's `RateCard`). Under its counter, a table on the
  grid, opening as a section opener does (centred eyebrow and headline
  over a faint pixel field); then a head row that scrolls with the page,
  never sticking: an empty first column, a column per plan, all three
  a third wide, so their lines run on from the plans' cells above, each
  its name, a line and its button (the primary for Peal Cloud). A row per
  feature: its name (15 px, 500), a bordered tag holding the marks of the
  platforms it covers and their kind, a muted line; each plan's value
  after a blue check where it is granted in full. Then a group per kind
  of usage (Usage, X's API, Limits), ui-sdk's accordion, closed at first
  and found by the browser's search:
  a 40 px `brand-tint` tile with the group's icon in blue, its title and
  muted explanation under it, a chevron that turns; its rows as the
  features'. Narrower than 1024 px, it scrolls sideways at 720 px.
- **Closing band.** The last section before the footer is a call to
  action on the page's grid, with the pixel glow in its band layout
  behind it: a headline and a muted line, centred, the primary button
  and an outline one.
- **FAQ.** Its counter as a section opener's, then a band on the grid,
  as tall as an opener, in two cells: on the left, quiet pixel art
  filling the cell (an icon rasterised onto 5 px cells in the blue and
  lavender tints, `#E8ECFD` and `#EDE7FF`, with lavender on the brightest
  cells, so it reads as texture) behind a small mono label, `// [icon] FAQ
  \\`, on `background`; on the right, the section headline with its second
  sentence in muted text, and a lead. Blue stays for links and selection,
  never a headline's accent word. Then a row per group: its title (15 px, 600) in the left cell and its questions in the right, as ui-sdk's
  accordion: full-width rows between hairlines, the question at 16 px, 500,
  a chevron at the end that turns as it opens, and the answer in muted
  text, 14 px, under a hairline. Several answers may be open at once;
  closed ones stay in the page, found by the browser's search. Below
  768 px the cells stack and the art becomes a strip 96 px tall. The
  questions are also the page's FAQPage JSON-LD.
- **Footer**, on `background` under a full-width rule: the mark and the
  language menu in a first cell, then a bordered cell per column of
  links, in this order: PealCreative, PealAPI (each product's docs pages),
  Resources (the docs, the blog, the changelog, self-hosting, status,
  security), Socials (Peal's accounts, Discord and GitHub) and Company
  (pricing, cookie settings, which opens the consent notice where the
  site measures, then the Policies menu). A caption row at
  the foot: `© <year> Peal` alone. The Policies menu is Company's last entry, a quiet text
  trigger with a chevron, in the links' type, that opens upward the
  privacy policy, the terms and the contract's functions (cancel,
  withdraw), each a link, repeated in a `<noscript>`.
  The language menu is a small
  outline button (30 px): `Languages`, the current language's own name
  and a chevron, named "Language" and that name for screen readers. It
  opens upward a menu of the same page in each language, each item a
  link with its `hreflang` and `lang`, the current one checked; a
  `<noscript>` repeats the links as a row for a reader without
  JavaScript.
- **Hero art.** The home page's hero shows the product, in its stage,
  over the pixel glow, and no other art: the turning cube it once held is
  gone. Pixel art stays in the menu previews, the section openers, the
  FAQ, the feature tiles, the consent notice, and the pixel glow of the
  hero and the closing band.

## Writing

Sentence case everywhere. Buttons say what they do ("Connect a channel",
"Create key"). Say what happened and what to do next; no exclamation marks
and no emoji in the interface. `packages/peal-docs/WRITING.md` holds the
voice.

## Do's and Don'ts

### Do

- Keep `{colors.brand}` blue for meaning: links, focus, selection, today,
  scheduled.
- Make the page's main action one `button-primary`, in ink.
- Draw structure with `{colors.hairline}` borders; lift only what floats.
- Use the spacing tokens and the component sizes above; a new size joins
  the front matter first.
- Give every list the same toolbar, Filter, Display and selection bar.
- Offer Undo for what can be taken back; ask first only for what cannot.
- Give every action a command in `⌘K`, and the frequent ones a key.
- Show a platform by its own mark, from its owner's file.

### Don't

- Don't add a dark theme or a `dark:` class.
- Don't make a button blue, or use blue as decoration.
- Don't write text, icons or a needed line in lavender or yellow.
- Don't put the brand field in the app or the docs, or twice on a screen.
- Don't give a list item a card of its own: one bordered list.
- Don't restyle a peal-ui component from a page; ask for a variant.
- Don't put actions in the selection bar: they live in the command menu.
- Don't keep a list's filters out of the address.
- Don't name a page two ways.

## Responsive behavior

| Name    | Width   | Key changes                                                                              |
| ------- | ------- | ---------------------------------------------------------------------------------------- |
| Desktop | 1280 px | The frame as drawn; content 72 rem at most.                                              |
| Tablet  | 1024 px | The site's header collapses into a drawer; mega menus fit from here.                     |
| Small   | 768 px  | The sidebar becomes a sheet behind the header's menu button; the panel fills the window. |
| Phone   | 640 px  | Display type steps down (56 → 36, 40 → 30); one column.                                  |
| Narrow  | 320 px  | Dialogs and sheets still fit, in English and French.                                     |

### Touch targets

- Controls keep 34 px; on a touch screen a control's hit area reaches
  44 px around it (a checkbox's reaches past its box).
- Checkboxes of a list show on every row on a touch screen, with no
  hover to reveal them.

### Collapsing

- **Sidebar**: a sheet from the left below 768 px; its links close it.
- **Command menu's button**: its icon alone on a phone.
- **List toolbar**: wraps; Filter and Display stay at the end of the views.
- **A list row's actions**: a line of their own under the item's text on
  a phone, at the row's end from 640 px.
- **Display type**: steps down below 640 px as the hierarchy says.

## Iteration guide

1. Change one component at a time, by its `components:` token.
2. Decide its level (elevation) and its radius from the scales before its
   look.
3. Default text to `{typography.body}`; reach for a heading token only for
   what heads.
4. Keep blue for meaning; check every new colour against the contrast
   tables.
5. Change `tokens.css` with this file; `nx run peal-ui:test` checks them
   together.
6. Add a variant as a component entry of its own.
7. Build a new pattern once, in peal-ui, and reuse it on every screen.

## Known gaps

- Card padding moves from 16–18 px to 24 px: the components follow screen
  by screen.
- Form error styling is shadcn/ui's, not yet written down here.
