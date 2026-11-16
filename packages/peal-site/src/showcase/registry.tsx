// One entry per file under peal-ui's src/blocks, which test/showcase.test.ts
// checks: how the showcase renders the block, and the props of each of its
// specimens, shown beside it as JSON. Specimens render on the server, but
// for an interactive block's, which hydrate on the page as one island.
import { Cell } from "peal-ui/blocks/blueprint/cell";
import { CellGrid } from "peal-ui/blocks/blueprint/cell-grid";
import { CornerFrame } from "peal-ui/blocks/blueprint/corner-frame";
import { Mark } from "peal-ui/blocks/blueprint/mark";
import { MarkTile } from "peal-ui/blocks/blueprint/mark-tile";
import { Section } from "peal-ui/blocks/blueprint/section";
import { Tick } from "peal-ui/blocks/blueprint/tick";
import { SectionHeading } from "peal-ui/blocks/text/section-heading";
import type { SectionHeadingContent } from "peal-ui/blocks/text/section-heading";
import { SectionLabel } from "peal-ui/blocks/text/section-label";
import type { SectionLabelContent } from "peal-ui/blocks/text/section-label";
import { Statement } from "peal-ui/blocks/text/statement";
import type * as React from "react";

import type { Category } from "./categories.ts";
import { contentPending } from "./content-pending.ts";
import {
  exampleLetters,
  exampleMark,
  frenchLength,
  long,
  short,
} from "./fixtures.ts";

export interface ShowcaseSpecimen {
  readonly name: string;
  /** The props the block is given, as JSON, as a page would pass them. */
  readonly json: string;
  readonly render: () => React.ReactElement;
}

export interface ShowcaseEntry {
  readonly categories: readonly Category[];
  /** Whether no real content exists for it yet (content-pending.ts). */
  readonly contentPending: boolean;
  /** S, static HTML, or I, an island that hydrates. */
  readonly interactive: boolean;
  /** What the block is, in a sentence. */
  readonly purpose: string;
  /** Its path under peal-ui's src/blocks, which is its address here. */
  readonly slug: string;
  readonly specimens: readonly ShowcaseSpecimen[];
}

interface EntryOf<Props extends object> {
  readonly categories: readonly Category[];
  readonly interactive?: boolean;
  readonly purpose: string;
  readonly render: (props: Props) => React.ReactElement;
  readonly slug: string;
  readonly specimens: readonly {
    readonly name: string;
    readonly props: Props;
  }[];
}

// Types each entry's specimens against its own render, and binds each to
// its props, so the entries share one list.
const entry = <Props extends object>(
  definition: EntryOf<Props>
): ShowcaseEntry => ({
  categories: definition.categories,
  contentPending: contentPending.includes(definition.slug),
  interactive: definition.interactive ?? false,
  purpose: definition.purpose,
  slug: definition.slug,
  specimens: definition.specimens.map((specimen) => ({
    name: specimen.name,
    json: JSON.stringify(specimen.props, undefined, 2),
    render: () => definition.render(specimen.props),
  })),
});

const cellCopy = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    body: short.body,
    id: `cell-${index + 1}`,
    title: `Cell ${index + 1}`,
  }));

export const registry: readonly ShowcaseEntry[] = [
  entry<{ readonly rule: "both" | "none" | "top"; readonly title: string }>({
    categories: ["Borders", "Backgrounds"],
    purpose:
      "A full-width rule with a tick where it meets each rail, then the 72 rem column.",
    render: ({ rule, title }) => (
      <Section labelledBy={`section-${rule}`} rule={rule}>
        <SectionHeading
          headingId={`section-${rule}`}
          heading={{ level: 3, title }}
        />
      </Section>
    ),
    slug: "blueprint/section",
    specimens: [
      { name: "Rule above", props: { rule: "top", title: short.title } },
      {
        name: "Rules above and below",
        props: { rule: "both", title: short.title },
      },
      { name: "No rule", props: { rule: "none", title: short.title } },
    ],
  }),
  entry<{
    readonly cells: readonly {
      readonly body: string;
      readonly id: string;
      readonly title: string;
    }[];
    readonly columns: 1 | 2 | 3 | 4;
    readonly filler?: 1 | 2;
  }>({
    categories: ["Borders", "Backgrounds"],
    purpose:
      "Bordered cells side by side, as tall as each other, one column on a phone; neighbours share one line.",
    render: ({ cells, columns, filler }) => (
      <Section rule="both">
        <CellGrid columns={columns} render={<ul />}>
          {cells.map((cell) => (
            <Cell key={cell.id} render={<li />}>
              <h3 className="text-[15px] font-semibold">{cell.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{cell.body}</p>
            </Cell>
          ))}
          {filler === undefined ? null : (
            <Cell render={<li />} span={filler} surface="hatch" />
          )}
        </CellGrid>
      </Section>
    ),
    slug: "blueprint/cell-grid",
    specimens: [
      { name: "Three columns", props: { cells: cellCopy(3), columns: 3 } },
      { name: "Four columns", props: { cells: cellCopy(4), columns: 4 } },
      {
        name: "Two columns, a short row filled with a hatched cell",
        props: { cells: cellCopy(3), columns: 2, filler: 1 },
      },
      { name: "One column", props: { cells: cellCopy(2), columns: 1 } },
    ],
  }),
  entry<{
    readonly body: string;
    readonly span?: 1 | 2 | 3;
    readonly title: string;
  }>({
    categories: ["Backgrounds"],
    purpose:
      "One cell, on background, card or muted, or hatched where it only holds the grid's shape.",
    render: ({ body, span, title }) => (
      <Section rule="both">
        <CellGrid columns={3}>
          <Cell span={span}>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{body}</p>
          </Cell>
          <Cell surface="card">
            <p className="text-sm">card</p>
          </Cell>
          <Cell surface="muted">
            <p className="text-sm">muted</p>
          </Cell>
          <Cell span={2} surface="hatch" />
          <Cell>
            <p className="text-sm">background</p>
          </Cell>
        </CellGrid>
      </Section>
    ),
    slug: "blueprint/cell",
    specimens: [
      {
        name: "The four surfaces",
        props: { body: short.body, title: "background" },
      },
    ],
  }),
  entry<{ readonly on: "field" | "page" }>({
    categories: ["Borders"],
    purpose: "The ±5 px crosshair where two lines of the blueprint meet.",
    render: ({ on }) => (
      <div
        className={
          on === "field"
            ? "relative h-24 bg-(image:--field-base)"
            : "relative h-24"
        }
      >
        <Tick className="start-1/2 top-1/2" on={on} />
      </div>
    ),
    slug: "blueprint/tick",
    specimens: [
      { name: "On the page, in input", props: { on: "page" } },
      { name: "On the brand field", props: { on: "field" } },
    ],
  }),
  entry<{ readonly caption: string }>({
    categories: ["Borders", "Images"],
    purpose: "A frame for art or a figure, with a tick on each corner.",
    render: ({ caption }) => (
      <Section rule="both">
        <div className="p-10">
          <CornerFrame className="bg-muted flex h-48 items-center justify-center">
            <p className="text-muted-foreground font-mono text-xs">{caption}</p>
          </CornerFrame>
        </div>
      </Section>
    ),
    slug: "blueprint/corner-frame",
    specimens: [
      { name: "Around a figure", props: { caption: "a synthetic figure" } },
    ],
  }),
  entry<{ readonly marks: readonly (typeof exampleMark)[] }>({
    categories: ["Clients"],
    purpose:
      "A brand's mark from simple-icons in currentColor, or a lettered tile for a brand without one.",
    render: ({ marks }) => (
      <div className="flex items-center gap-4 p-6">
        {marks.map((mark) => (
          <Mark
            key={mark.kind === "path" ? mark.path : mark.letters}
            mark={mark}
            className="size-6"
          />
        ))}
      </div>
    ),
    slug: "blueprint/mark",
    specimens: [
      {
        name: "A path and a lettered tile",
        props: { marks: [exampleMark, exampleLetters] },
      },
    ],
  }),
  entry<{ readonly label?: string; readonly size: 32 | 40 }>({
    categories: ["Clients", "Docks"],
    purpose:
      "A brand's mark or a lucide icon in a bordered tile, 32 or 40 px, as the mega menus have.",
    render: ({ label, size }) => (
      <div className="flex items-center gap-2 p-6">
        <MarkTile icon="calendar" size={size} />
        <MarkTile icon="terminal" size={size} />
        <MarkTile label={label} mark={exampleMark} size={size} />
        <MarkTile mark={exampleLetters} size={size} />
      </div>
    ),
    slug: "blueprint/mark-tile",
    specimens: [
      { name: "32 px, as a menu row", props: { size: 32 } },
      { name: "40 px, named", props: { label: "Example Company", size: 40 } },
    ],
  }),
  entry<SectionLabelContent>({
    categories: ["Texts"],
    purpose:
      "A section's caption in brackets, with its place on the page if asked.",
    render: (props) => (
      <div className="p-6">
        <SectionLabel {...props} />
      </div>
    ),
    slug: "text/section-label",
    specimens: [
      { name: "A word", props: { text: short.label } },
      { name: "With its place", props: { index: 2, of: 6, text: short.label } },
    ],
  }),
  entry<SectionHeadingContent>({
    categories: ["Texts"],
    purpose:
      "A section's label, headline with a muted second sentence, and lead.",
    render: (heading) => (
      <Section labelledBy="heading-specimen" rule="both">
        <SectionHeading headingId="heading-specimen" heading={heading} />
      </Section>
    ),
    slug: "text/section-heading",
    specimens: [
      {
        name: "Default",
        props: {
          label: { index: 2, of: 6, text: short.label },
          lead: short.lead,
          title: short.title,
          titleMuted: short.titleMuted,
        },
      },
      {
        name: "Longest copy",
        props: { label: { text: short.label }, ...long },
      },
      {
        name: "French length",
        props: { label: { text: "fonctions" }, ...frenchLength },
      },
      { name: "Fewest props", props: { title: short.title } },
    ],
  }),
  entry<{ readonly body: string; readonly lead: string }>({
    categories: ["Texts"],
    purpose:
      "A paragraph that leads with a phrase in ink and continues in muted text.",
    render: (props) => (
      <div className="p-6">
        <Statement {...props} />
      </div>
    ),
    slug: "text/statement",
    specimens: [
      {
        name: "Default",
        props: { body: short.statementBody, lead: short.statementLead },
      },
    ],
  }),
];

export const entryOf = (slug: string): ShowcaseEntry | undefined =>
  registry.find((candidate) => candidate.slug === slug);
