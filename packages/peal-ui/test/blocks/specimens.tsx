// Every block once, with each string it shows set to a sentinel, for the
// tests that read its markup whole: no copy inside (no-copy.test.tsx) and
// structure (structure.test.tsx). A block that is missing here fails both.
import type * as React from "react";

import { Cell } from "../../src/blocks/blueprint/cell";
import { CellGrid } from "../../src/blocks/blueprint/cell-grid";
import { CornerFrame } from "../../src/blocks/blueprint/corner-frame";
import { Mark } from "../../src/blocks/blueprint/mark";
import { MarkTile } from "../../src/blocks/blueprint/mark-tile";
import { Section } from "../../src/blocks/blueprint/section";
import { Tick } from "../../src/blocks/blueprint/tick";
import { SectionHeading } from "../../src/blocks/text/section-heading";
import { SectionLabel } from "../../src/blocks/text/section-label";
import { Statement } from "../../src/blocks/text/statement";

/** A string a block can only have from its props. */
export const copy = (name: string) => `copy:${name}`;

/** A simple-icons-like path: a square, standing for any brand's mark. */
export const squarePath = "M2 2h20v20H2z";

const table = {
  "blueprint/cell": [
    () => <Cell>{copy("cell")}</Cell>,
    () => <Cell surface="hatch">{copy("hidden")}</Cell>,
  ],
  "blueprint/cell-grid": [
    () => (
      <CellGrid columns={2} render={<ul />}>
        <Cell render={<li />}>{copy("first")}</Cell>
        <Cell render={<li />}>{copy("second")}</Cell>
      </CellGrid>
    ),
  ],
  "blueprint/corner-frame": [() => <CornerFrame>{copy("figure")}</CornerFrame>],
  "blueprint/mark": [
    () => <Mark mark={{ kind: "path", path: squarePath }} />,
    () => <Mark mark={{ kind: "letters", letters: copy("letters") }} />,
  ],
  "blueprint/mark-tile": [
    () => <MarkTile icon="calendar" />,
    () => (
      <MarkTile
        label={copy("brand")}
        mark={{ kind: "path", path: squarePath }}
        size={40}
      />
    ),
  ],
  "blueprint/section": [
    () => (
      <Section labelledBy="specimen-heading" rule="both">
        <h2 id="specimen-heading">{copy("heading")}</h2>
      </Section>
    ),
  ],
  "blueprint/tick": [() => <Tick />, () => <Tick on="field" />],
  "text/section-heading": [
    () => (
      <SectionHeading
        heading={{
          label: { index: 2, of: 6, text: copy("label") },
          lead: copy("lead"),
          title: copy("title"),
          titleMuted: copy("muted"),
        }}
      />
    ),
  ],
  "text/section-label": [
    () => <SectionLabel text={copy("label")} />,
    () => <SectionLabel index={2} of={6} text={copy("label")} />,
  ],
  "text/statement": [
    () => <Statement body={copy("body")} lead={copy("lead")} />,
  ],
} satisfies Readonly<Record<string, readonly (() => React.ReactElement)[]>>;

/** Each block's file, under src/blocks without `.tsx`, and its specimens. */
export const specimens = new Map(Object.entries(table));
