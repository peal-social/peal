# Peal design

How Peal looks and is laid out: the web app first, and the site and the docs
after it. `packages/peal-ui/src/styles/tokens.css` carries these values as
plain CSS variables. The web app and the site read them through
peal-ui's `globals.css`, and the docs through
`packages/peal-docs/theme.css`. Change this file and the
tokens together: `nx run peal-ui:test` fails when the colour tables or the
radius here and the tokens differ. Contributors and agents read this before
changing a screen.

## Light only

Peal has one theme, light. There is no dark mode yet, so no screen follows
the operating system's setting and none offers a switch:

- peal-ui, shadcn/ui's components on ui-sdk's behaviour, sets
  `color-scheme: light` and defines no dark tokens. Its `dark:`
  variant matches a `.dark` class that nothing sets, so the `dark:` classes
  shadcn/ui's components bring with them stay inert.
- Write no `dark:` class in Peal's own code, in the web app or the site.
- The docs set Blume's `theme.mode` to `light`, without its toggle.

## Colour

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

### Neutrals

Warm greys (stone), from the page out:

| Token                | Value     | Use                                                 |
| -------------------- | --------- | --------------------------------------------------- |
| `background`         | `#FAFAF9` | The page, the sidebar and the top bar.              |
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
4.5:1. Nothing is bold or italic: colour alone tells the kinds apart, and
a reader who cannot see it loses nothing they need to run the code.

## Type

Geist for text and Geist Mono for what is read character by character: ids,
slugs, keys, times, counts, code and keyboard shortcuts. peal-ui ships both
(`peal-ui/lib/fonts`); the docs name `geist` and `geist-mono` in Blume.

| Role            | Size | Weight | Notes                                             |
| --------------- | ---- | ------ | ------------------------------------------------- |
| Home headline   | 30   | 600    | Two lines, the second in muted text.              |
| Page title      | 24   | 600    | Only where a page has no toolbar.                 |
| Section heading | 15   | 600    |                                                   |
| Body, controls  | 14   | 400    | 500 for the current item and labels.              |
| Secondary       | 13   | 400    | Hints, cells' second line.                        |
| Small           | 12   | 400    | Table headers (upper case), group labels, badges. |

Numbers that line up use `tabular-nums`. Letter spacing is `-0.025em` at
24 px and above, none below.

### The site's headlines

The marketing site speaks louder than the app, and only its headlines do:
everything below them keeps the table above.

| Role             | Size (phone) | Weight | Notes                                           |
| ---------------- | ------------ | ------ | ----------------------------------------------- |
| Hero headline    | 56 (36)      | 600    | One per page, line height 1.05.                 |
| Section headline | 40 (30)      | 600    | Line height 1.1; a second sentence in muted.    |
| Lead             | 18 (16)      | 400    | Under a headline, at most 40 rem wide.          |
| Caption          | 12           | 400    | Geist Mono, lowercase, `0.04em`, in muted text. |

Headlines keep `-0.025em`; "phone" is below 640 px.

## Shape and space

- A 4 px grid. Pages have 16 px of padding inside the content area; cards
  16 to 18 px.
- Radius: 6 px for controls, cards, tables, menus and dialogs; 4 px for
  chips, badges and keys; full for avatars and dots.
- Borders before shadows. A shadow lifts only what floats: menus,
  popovers, dialogs, the selected segment of a switch.
- Heights: controls 34 px (30 small, 38 for a toolbar's search); sidebar
  rows 34; table rows about 44; the top bar 56.

## Icons

lucide, at 16 px in navigation and buttons (stroke 1.75) and 12 to 14 px in
chips (stroke 2), in `currentColor`. An icon-only button has an
`aria-label`. Platforms are shown by their own marks where they allow it,
else by a lettered tile; never draw a platform's logo from memory.

A sign-in provider's button is an outline button of the control height,
the provider's own mark at 16 px, half the control's height as Google
sets its 20 px G in a 40 px button (Google's full-colour "G" from the
file its branding guidelines publish, byte for byte, never redrawn or
monochrome; lucide's `KeyRound` for a provider without one), then "Continue with" and its name. The buttons sit
above the form, with "or" on a divider before it, and never take the
page's main action, which stays the primary button.

## Brand field

The brand field is Peal's one gradient: the mark's colours glowing on a
deep blue, drawn exactly as Peal's social banners are. peal-ui's
`BrandField` renders it, from the `--field-*` tokens.

**Where.** Only on the site's hero, a closing call-to-action band at the
foot of a site page, the art area of a site menu's preview card, and covers
and social images (blog covers, Open Graph images, the social banners).
Never in the app or the docs, and never twice on one screen but for a menu
open over the hero.

**On it.** White text only (`#FFFFFF`), over the base and the blue glow
(5:1 or better there), never over the lavender or yellow glows, which sit
at the corners for that reason; then the rails and their captions. A button on it is white with ink text, the primary button
inverted. The site's hero may hold one `background` panel between its
rails, with the 6 px radius and no border or shadow, for the home page's
stage (see [Site](#site)); no other surface sits on the field.

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

## The frame

Every signed-in page has the same frame:

- **Sidebar**, 240 px, on `background`, with a border on its right:
  - At the top, the **mode switch**, with the Peal mark inside it: Studio,
    for running a workspace's channels, and Console, for building on the
    API. The mark and the two modes share one frame; switching is one
    click, never a menu. The mark's tile is white in Studio and ink in
    Console, so the mode shows at a glance. Each page belongs to one mode,
    so the address carries it; switching opens the other mode's first page
    the member may open, and a mode with none is shown disabled.
  - The mode's navigation, in groups with a small label, listing only the
    pages the member's permissions open. A section with pages of its own
    (Posts and Settings today) shows a chevron and **drills down**: on its
    pages, the sidebar shows that section's pages under a back link.
  - Settings at the foot, then the workspace switcher.
- **Top bar**, 56 px, aligned with the sidebar's top: the menu button on a
  phone, the breadcrumb (with a count in Geist Mono where a page has one),
  then search (`⌘K`, once there is search), Docs and
  Support.
- **Content** on `background`, in white cards and tables. Full-bleed tools
  (the calendar, the inbox, the composer) are white edge to edge.

Studio holds Home, Calendar, Posts, Channels and Media, then Inbox,
Analytics and Ads under Engage. Console holds Platforms, then API keys and
Webhooks under Build, and Partner under Partners; a page the API offers
later (connect links, activity, usage, OAuth apps) joins it there. The
person's own pages, outside any workspace (the overview, the agenda, the
report, the notices, the account), have a sidebar of their own, with
their workspaces under it.

## Pages

- **Lists** lead with their toolbar: search, filter menus, sort, the view,
  then the page's main action on the right. A full-width table follows.
  Each row opens what it shows, with a chevron at its end.
- **Empty states** say what will appear and give the one next step.
- **Errors** name the cause and carry the fix beside it (crop, reconnect,
  review).
- **Settings** are rows: label and hint on the left, the control on the
  right, in cards grouped under a heading, with what cannot be undone last.
- **The composer** writes one text with a tab per channel, counts each
  platform's limit, and shows a preview beside it.
- **Hosted pages** (a connect link's page, which a partner's customers
  open) are one white card on `background`, headed by who asks: the
  partner's logo and name. A partner's accent colour is a 4 px line along
  the card's top, above the logo, and nothing else: never text, an icon,
  a fill or a button, which keep Peal's colours. The server takes only
  `#RRGGBB` with at least 3:1 contrast against `card` and `background`
  (WCAG's bar for a line that must be seen), so lavender- or yellow-like
  colours are refused.

## Docs

The docs are Blume, dressed in the same tokens: `theme.css` maps Blume's
`--blume-*` variables onto peal-ui's, so the page, borders, muted text, code
blocks and radius are the app's, and no colour is written there twice.

- **Tabs**, across the top: Get started, Guides (running a workspace, the
  app's Studio), Platforms, Developers (building on the API, the app's
  Console), the API reference and Self-hosting. Each page belongs to one.
- **Sidebar groups** take the names and the order of the app's own
  navigation, so a page and the screen it explains are called the same:
  Guides has Channels, Posts, Media, Engage and Settings as labelled groups
  (Blume's `flat` display). Elsewhere a section with pages of its own drills
  down, as the app's sidebar does (Blume's `page` display).
- **Figures** a platform or a plan sets (text limits, prices) come from the
  contract as Blume variables, never typed into a page.
- **One page, one task**, for one reader. Where the app, the API, the
  command line and MCP do the same thing, one block of tabbed samples and a
  link to the Developers page replace a section for each.
- **Platforms** are shown by their own marks, from the same files as the
  app's, never redrawn.

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
  mega menu), Pricing, Docs and Blog in the middle; on the right the
  GitHub mark with the star count (Geist Mono, hidden when unknown), a
  vertical divider, the Discord mark alone (an icon-only button with its
  `aria-label`), Log in (a ghost button) and Get started (the primary
  button). Below 1024 px the middle and right collapse into a menu button
  that opens a drawer from the right, with the same items.
- **Mega menu.** One floating panel (the shadow of a popover), white, with
  the 6 px radius. Its links are grouped under a small label (12 px,
  muted), in bordered cells side by side. A row is a 16 px lucide icon in
  a bordered 32 px tile, a title (14 px, 500) and a one-line description
  (13 px, muted), with the `accent` hover; a row that names a brand, such
  as a platform, has its 16 px mark in the same tile and its name alone.
  A group's label may name a product, in ink and 500, followed by whom
  it is for in muted text: Products has "PealStudio for marketing teams"
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
  row. The drawer has no preview.
- **Platforms menu.** Every platform a channel connects to and every ad
  network, from the contract's lists, under Social (a wide cell of two
  columns), then Chat, Ads and Blog stacked in one column beside it, each
  row linking to the platform's docs page; both kinds of WordPress site
  are one entry. Its preview is one post fanning out to many networks:
  the mark in the centre, joined by spokes to nodes around it. A small
  text link under the rows compares every platform. The panel fits from
  1024 px up.
- **Marks on the site.** Brands' marks (platforms, GitHub, Discord) come
  from simple-icons, at the version the workspace pins, in `currentColor`:
  ink, or muted text in the drawer, never the brand's colour. A brand
  missing from simple-icons (LinkedIn, Slack, Google Business Profile) is a
  lettered tile in ink.
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
- **Code demo.** A bordered panel with ui-sdk's tabs (API, CLI, MCP,
  SDK) along its top; each tab shows the request on the left and the
  response on the right, both on `muted` in Geist Mono 13 px, each under
  a mono caption, and a ghost Copy button on the request's caption. The
  requests are the docs' own, the responses the contract's shapes, and
  every id is made up and reads as such. Long lines wrap, breaking
  anywhere, so nothing hides past a panel's edge at any width.
- **Tiles.** Bordered cells in rows of four (two on a phone), under a
  mono group label: a 36 px bordered tile with an icon or a brand's mark,
  an arrow pointing out, a title (15 px, 600) and an optional line.
- **Two products.** Peal is presented as two products on one workspace,
  spelled `PealStudio` (for marketing teams) and `PealAPI` (for
  developers and agents): the two sides of the app's mode switch (see
  [The frame](#the-frame)). A product's name is set as one word, in the
  text's own colour, never as a logo.
- **Hero stage.** Under the home page's headline (left, with its
  buttons) and lead (right), one `background` panel on the brand field:
  ui-sdk's tabs as a segmented switch across its top, on `muted`, one
  segment per product with the mark in a 20 px tile (white for
  PealStudio, ink for PealAPI, as the app's switch draws its modes); the
  selected segment is `card` with the switch's shadow. Its panel holds
  the product's demo: for PealStudio, the composer (one post, a tab per
  channel, each platform's count against its limit from the contract, a
  preview beside it), for PealAPI the code demo. Under the demo, a row of
  chips, one per feature of the selected product (a 14 px icon, its name
  and an arrow pointing out, 4 px radius, bordered), each linking to its
  docs page. Below 768 px the composer's preview goes under its text.
- **Two platforms panel.** Under a section opener, the two products in
  two bordered cells (the name, 15 px, 600, then a line at the lead's
  size, muted), then one wide cell on `muted` holding a page of each side
  of the app next to each other (stacked below 1024 px): the frame
  drawn small, a sidebar of 176 px with the mode switch and the mode's
  groups, the 56 px top bar with the breadcrumb, and the content in white
  cards (Studio's calendar; the API side's keys and webhook deliveries).
  Below 640 px the sidebar folds away and the switch moves into the top
  bar. The pages show only what the app has, with made-up content.
- **Product opening.** A product's section opens on the faint pixel
  field, left-aligned: the eyebrow with the product's name, the section
  headline and an outline button to its docs on the left, the lead on the
  right, level with the button. On a phone: headline, lead, button.
- **Product bento.** Under PealStudio's opening: two feature cells side
  by side, each with a mock from the app (the composer's previews, one
  row per platform with its count and chip; the page a reviewer opens
  from a review link), then four tiles in a row (two on a phone), each
  still pixel art of its icon, the icon and a title (15 px, 600) and a
  line, linking to its docs page.
- **Product rows.** Under PealAPI's opening: one bordered row per part,
  its title (an icon, 15 px, 600), a paragraph and a link to its docs
  page on the left (5 of 12 columns), and on the right its code (the code
  demo's blocks, stacked, without tabs), its tiles (the SDKs' marks in
  bordered cells, four to a row, two on a phone) or a mock from the app
  (a connect link's page). Stacked below 768 px.
- **Closing band.** The last section before the footer is a call to
  action on the brand field: a white headline and line, centred, a white
  button with ink text and a white text link, with the field's rails on
  the page's and its captions.
- **FAQ.** A band on the grid, in two cells: on the left, quiet pixel art
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
- **Footer**, on `background` under a full-width rule: the mark, the
  licence's line and the language menu in a first cell, then a bordered
  cell per column of links (legal, the contract's functions, Peal's
  accounts), and a caption row at the foot. The language menu is a small
  outline button (30 px): `Languages`, the current language's own name
  and a chevron, named "Language" and that name for screen readers. It
  opens upward a menu of the same page in each language, each item a
  link with its `hreflang` and `lang`, the current one checked; a
  `<noscript>` repeats the links as a row for a reader without
  JavaScript.
- **Hero art.** The home page's hero shows the product, in its stage,
  and no other art: the turning cube it once held is gone. Pixel art
  stays in the menu previews, the section openers, the FAQ and the
  feature tiles.

## Writing

Sentence case everywhere. Buttons say what they do ("Connect a channel",
"Create key"). Say what happened and what to do next; no exclamation marks
and no emoji in the interface.
