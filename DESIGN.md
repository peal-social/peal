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
4.5:1. Nothing is bold or italic. The kinds differ by colour alone, and
none of them is needed to read or run the code.

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
`aria-label`. Platforms are shown by their own marks: simple-icons', or,
for a brand it does not hold (LinkedIn, Slack, Google Business Profile),
the file its owner publishes, kept in peal-ui's `src/brand-marks` with
where it came from; a lettered tile only for a brand with neither. Never
draw a platform's logo from memory.

A sign-in provider's button is an outline button of the control height,
the provider's own mark at 16 px, half the control's height as Google
sets its 20 px G in a 40 px button (Google's full-colour "G" from the
file its branding guidelines publish, byte for byte, never redrawn or
monochrome; lucide's `KeyRound` for a provider without one), then "Continue with" and its name. The buttons sit
above the form, with "or" on a divider before it, and never take the
page's main action, which stays the primary button.

## Brand field

The brand field is Peal's one gradient surface: the mark's colours
glowing on a deep blue, drawn exactly as Peal's social banners are.
peal-ui's `BrandField` renders it, from the `--field-*` tokens. The only
other gradient is a line, the pricing slider's fill (see Account
calculator).

**Where.** Only in the art area of a site menu's preview card, and on
covers and social images (blog covers, Open Graph images, the social
banners). Never in the app or the docs, and never twice on one screen. The
site's pages themselves stay on the light grid: their hero and closing band
show the field's glows as pixels instead (the pixel glow, see
[Site](#site)).

**On it.** White text only (`#FFFFFF`), over the base and the blue glow
(5:1 or better there), never over the lavender or yellow glows, which sit
at the corners for that reason; then the rails and their captions. A
button on it is white with ink text, the primary button inverted.

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
  - At the top, the **mode switch**, with the Peal mark inside it: PealStudio,
    for running a workspace's channels, and PealAPI, for building on the
    API. They are the site's product names, one word each, never
    translated. The mark and the two modes share one frame; switching is one
    click, never a menu. The mark's tile is white in PealStudio and ink
    in PealAPI, so the mode shows at a glance. Each page belongs to one mode,
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

PealStudio holds Home, Calendar, Posts, Channels and Media, then Inbox,
Analytics and Ads under Engage. PealAPI holds Platforms, then API keys and
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
- **Consent.** A question Peal must ask, such as whether the app may
  link what someone does to their account and record their sessions, is
  a card in the page's content, never a bar across the frame, a dialog or
  anything that floats. Its two answers are two buttons of the same
  variant and size (`outline`), side by side, so refusing is as easy as
  accepting. The card leaves once answered, and the account page keeps
  the answer, where it can be changed. The site, the docs and the blog,
  where a visitor has no page of their own to be asked on, ask with the
  consent notice (see [Site](#site)).
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
  app's PealStudio), Platforms, Developers (building on the API, the
  app's PealAPI), the API reference and Self-hosting. Each page belongs to one.
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
  spelled `PealStudio` (for marketing teams) and `PealAPI` (for
  developers and agents): the two sides of the app's mode switch (see
  [The frame](#the-frame)). A product's name is set as one word, in the
  text's own colour, never as a logo.
- **Announcement bar.** A line the whole site must say (while Peal is
  not released, that it is in development), above every page's header:
  a thin ink bar across the page, 13 px text in `background`, centred,
  after a 5 px square in yellow, then a link with an arrow to read more.
  It cannot be dismissed, and the site removes it once it no longer holds;
  no page repeats it.
- **Consent notice.** The one question the site, the docs and the blog
  ask a visitor: whether Peal may keep a cookie to follow their visits.
  It is peal-ui's `<peal-consent>`, the same on all three. A white card
  (`card`, 1 px `border`, the 6 px radius, the shadow of a popover)
  fixed to the bottom right of the window, 16 px from its edges, 25 rem
  wide at most; from 1184 px up its right edge stands on the page's
  right rail. It is the only thing on the site that floats without being
  opened, and it never dims or blocks the page: no backdrop, no focus
  trap, and it takes no focus when it appears. Inside: the eyebrow
  `// [cookie] Cookies \\` (Geist Mono, 12 px, muted), a title (15 px,
  600), the text (14 px), a link to the privacy policy in `brand-text`,
  and the two answers as two `outline` buttons of the same size, side by
  side and equally wide, Allow first, as the app's consent card has
  them. Neither is the primary button and neither has focus. Below
  640 px it is a sheet along the bottom edge, full width, with a top
  border and no radius, at most half the window's height (its text
  scrolls above the answers), and the page gains that much padding at
  its foot so the footer stays reachable. Once answered it leaves, and
  **Cookie settings** in the footer (a row at the foot of the docs)
  opens it again, with the answer, its date and a ghost Close button;
  focus then goes to its title and returns to the link on closing. A
  browser that sends Do Not Track or Global Privacy Control is never
  asked.
  Its art is the pixel cookie: beside the text, an 85 px square of 5 px
  cells holding a round cookie, its dough in the blue and lavender tints
  (`#E8ECFD`, `#EDE7FF`), Bayer-dithered, its rim in lavender with a
  baked edge inside it toward the bottom right (`#D5C9FF`, the pixel
  glow's light lavender), and seven
  chips in the mark's blue, lavender and yellow that twinkle each on its
  own beat, as the pixel glow's cells do. Under it a readout in Geist
  Mono, 12 px, muted, says what each answer stores: `cookies: ?` at
  rest, `cookies: 1 · 183 d` while the pointer or focus is on Allow,
  `cookies: 0` on the other button. On Allow the chips slide, cell by
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
  once. On a phone the art is a still 25 px cookie beside the title, and
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
  PealStudio, ink for PealAPI, as the app's switch draws its modes); the
  selected segment is `card` with the switch's shadow. Its panel holds
  the product's demo: for PealStudio, the composer (one post, a tab per
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
  drawn small, a sidebar of 176 px with the mode switch and the mode's
  groups, the 56 px top bar with the breadcrumb, and the content in white
  cards (PealStudio's calendar; PealAPI's keys and webhook deliveries).
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
  links, in this order: PealStudio, PealAPI (each product's docs pages),
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
and no emoji in the interface.
