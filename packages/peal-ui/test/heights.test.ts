// DESIGN.md gives the controls' heights (34 px, 30 small, 38 for a toolbar's
// search): every control's size classes say the same, so a button, a field
// and a select sit on one line in a toolbar or a form.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buttonVariants } from "../src/components/button";

const design = readFileSync(
  path.join(import.meta.dirname, "../../../DESIGN.md"),
  "utf-8"
);

const source = (component: string) =>
  readFileSync(
    path.join(import.meta.dirname, `../src/components/${component}.tsx`),
    "utf-8"
  );

const heights =
  /controls (?<control>\d+) px \((?<small>\d+) small, (?<search>\d+) for a toolbar's search\)/u.exec(
    design
  )?.groups;

// Tailwind's spacing step is 4 px: 34 px is `8.5`.
const step = (name: "control" | "search" | "small") =>
  String(Number(heights?.[name]) / 4);

const control = step("control");
const small = step("small");
const search = step("search");

const classesOf = (classes: string) => classes.split(/\s+/u);

describe("DESIGN.md's control heights", () => {
  it("reads them", () => {
    expect(heights).toBeDefined();
    expect(Number(heights?.["control"])).toBeGreaterThan(0);
  });

  it.each([
    { expected: `h-${control}`, size: "default" },
    { expected: `h-${small}`, size: "sm" },
    { expected: `h-${search}`, size: "lg" },
    { expected: `size-${control}`, size: "icon" },
    { expected: `size-${small}`, size: "icon-sm" },
    { expected: `size-${search}`, size: "icon-lg" },
  ] as const)("gives a $size button $expected", ({ expected, size }) => {
    expect(classesOf(buttonVariants({ size }))).toContain(expected);
  });

  it("gives an input the control height", () => {
    expect(source("input")).toMatch(new RegExp(` h-${control} `, "u"));
  });

  it("gives a select's trigger the control height, and the small one", () => {
    expect(source("select")).toContain(`data-[size=default]:h-${control} `);
    expect(source("select")).toContain(`data-[size=sm]:h-${small} `);
  });

  it("gives a row of tabs the control height", () => {
    expect(source("tabs")).toContain(
      `group-data-horizontal/tabs:h-${control} `
    );
  });
});
