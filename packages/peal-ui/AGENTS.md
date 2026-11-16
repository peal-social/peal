# peal-ui

The design system's components follow
[`packages/peal-web/AGENTS.md`](../peal-web/AGENTS.md) (shadcn/ui's look on
ui-sdk). This guide adds the marketing blocks.

## Blocks

`src/blocks/<group>/<block>.tsx`, exported as `peal-ui/blocks/<group>/<block>`:
the sections the site (`peal-site`) and the blog compose their pages from.
`globals.css` names the folder in `@source`, so apps get the blocks'
classes. The groups are `blueprint`, `art`, `text`, `hero`, `feature`,
`cta`, `proof`, `pricing`, `compare`, `sequence`, `media`, `navigation`
and `announcement`. Non-React logic, such as the pixel renderers, lives in
`src/lib`.

- **Props are data**: strings, numbers, arrays and `{ href, label }`
  links, which an Astro page can pass as JSON. An icon is a name from
  `lib/site-icons`, a brand's mark a `SiteMark`. An Astro page cannot hand
  a block an element (`render={<ul />}`): a block composed that way is
  used from another React component.
- **No copy inside**: every visible string and every accessible name is a
  prop. The app translates and formats numbers, prices and dates; a block
  never calls `Intl`.
- **Slots** (`children`, `art`, `media`) carry rich or optimised content,
  such as the app's own image component. A block never fetches and never
  builds an image URL.
- **Static by default**: no `"use client"`, effect or hook but `useId`. An
  interactive block starts with `"use client"`, and the page picks the
  directive (`client:visible` below the fold). Behaviour is ui-sdk's, or a
  `definePrimitive` and `createParts` pair where ui-sdk lacks it.
- **Root** through `renderElement`, with `render`, `data-slot` and
  `className` on the root only. A block with a title takes `level?: 2 | 3`;
  only the heroes render an `h1`.
- **DESIGN.md's tokens only**: no hex or colour function, no Tailwind
  palette colour, no `dark:`, no shadow, no gradient but the brand field,
  `rounded-md`, `rounded-sm` or `rounded-full`, the type sizes of its two
  tables. Only the hero, the closing band and covers render `BrandField`.
  Only art moves by itself, still under reduced motion and off screen.
- **Blueprint**: a `Section` (rule, ticks, the 72 rem column), then cells in
  a `CellGrid`; content sits in cells, never in floating cards.

Tests, in `nx run peal-ui:test`:

- `test/blocks/<group>/<block>.test.tsx` renders the block with
  `renderToStaticMarkup`; `test/blocks-design.test.ts` fails a block
  without one, and reads every block's source against the rules above.
- `test/blocks/specimens.tsx` holds each block with sentinel strings, for
  `no-copy.test.tsx` (no string of the block's own) and
  `structure.test.tsx` (axe-core in jsdom). A new block joins it.
- An interactive block's behaviour is tested in jsdom
  (`// @vitest-environment jsdom`) with Testing Library and ui-sdk's
  `@ui-sdk/core/testing`, its stubs as ui-sdk's testing guide gives them.

Each block has a page on the site's showcase (`peal-site/src/showcase`,
at `/blocks` in `nx run peal-site:dev`, or in a build with `SITE_BLOCKS=on`):
an entry in `registry.tsx` with synthetic specimens from `fixtures.ts`,
which `peal-site`'s `showcase.test.ts` requires. A block with no real
content yet (customers' logos, quotes, people) is listed in
`content-pending.ts` and imported by no public page.
