// The blocks keep to DESIGN.md as text: tokens only, no shadow, two radii,
// the type sizes of its two tables, the brand field only where it may be,
// light only, and nothing that ties a block to one app. Read with
// tokens.test.ts, which holds the tokens to DESIGN.md.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { blockSlugs, blocksRoot } from "./blocks/block-files";

// The components the blocks bring with them, held to the same rules.
const components = ["accordion", "scroll-area"].filter((name) =>
  existsSync(path.join(import.meta.dirname, `../src/components/${name}.tsx`))
);

const files = [
  ...blockSlugs.map((slug) => ({
    name: slug,
    source: readFileSync(path.join(blocksRoot, `${slug}.tsx`), "utf-8"),
  })),
  ...components.map((name) => ({
    name: `components/${name}`,
    source: readFileSync(
      path.join(import.meta.dirname, `../src/components/${name}.tsx`),
      "utf-8"
    ),
  })),
];

// The blocks DESIGN.md's Brand field, "Where", allows on the field: the
// field itself, the hero and the closing band.
const onTheField = new Set([
  "art/brand-field",
  "hero/hero-field",
  "cta/cta-band",
]);

// DESIGN.md's type sizes, in pixels: the app's table and the site's.
const sizes = new Set([12, 13, 14, 15, 16, 18, 24, 30, 36, 40, 56]);

// Tailwind's named sizes, in pixels.
const namedSizes = new Map([
  ["2xl", 24],
  ["3xl", 30],
  ["4xl", 36],
  ["5xl", 48],
  ["6xl", 60],
  ["7xl", 72],
  ["8xl", 96],
  ["9xl", 128],
  ["base", 16],
  ["lg", 18],
  ["sm", 14],
  ["xl", 20],
  ["xs", 12],
]);

// A lettered tile is a mark, drawn to its tile's size, not text.
const markFiles = new Set(["blueprint/mark"]);

const palette =
  /(?:^|[\s"'`:])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|decoration|divide|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/u;

const blackOrWhite =
  /(?:^|[\s"'`:])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring|outline)-(?:white|black)\b/u;

// The class-like words of a file: what sits between spaces and quotes.
const words = (source: string) => source.split(/[\s"'`{}()]+/u);

// A word without its variants, such as `sm:` or `hover:`.
const utility = (word: string) => word.split(":").at(-1) ?? word;

// The tag of the JSX element an index sits in, such as `th`.
const elementAt = (source: string, index: number) =>
  /<(?<tag>[a-zA-Z][\w.]*)/u.exec(
    source.slice(source.lastIndexOf("<", index), index)
  )?.groups?.["tag"];

// A text-size utility's size in pixels, or undefined for another word.
const sizeOf = (word: string): number | undefined => {
  const arbitrary = /^text-\[(?<pixels>[\d.]+)px\]$/u.exec(word)?.groups?.[
    "pixels"
  ];

  if (arbitrary !== undefined) {
    return Number(arbitrary);
  }

  const named = /^text-(?<name>xs|sm|base|lg|xl|\dxl)$/u.exec(word)?.groups?.[
    "name"
  ];

  return named === undefined ? undefined : namedSizes.get(named);
};

// Rules on a file's whole source: the reason, and whether it is broken.
const sourceRules: readonly (readonly [
  string,
  (source: string, name: string) => boolean,
])[] = [
  ["a dark: class", (source) => /\bdark:/u.test(source)],
  ["a hex colour", (source) => /#[\da-f]{6}\b|#[\da-f]{3}\b/iu.test(source)],
  [
    "a colour function",
    (source) => /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/u.test(source),
  ],
  [
    "a Tailwind palette colour",
    (source) => palette.test(source) || blackOrWhite.test(source),
  ],
  [
    "upper case outside a table header",
    (source) =>
      [...source.matchAll(/\buppercase\b/gu)].some(
        (match) =>
          !["th", "thead"].includes(elementAt(source, match.index) ?? "")
      ),
  ],
  [
    "the brand field outside the hero, the closing band and covers",
    (source, name) =>
      /from "[^"]*brand-field"/u.test(source) && !onTheField.has(name),
  ],
  [
    "an import that ties the block to one app",
    (source) =>
      /from "(?:peal-contract[^"]*|next(?:\/[^"]*)?|astro[^"]*)"/u.test(source),
  ],
];

// Rules on each class-like word: the reason it is refused, if it is.
const wordRules: readonly ((
  word: string,
  name: string
) => string | undefined)[] = [
  (word) =>
    /^(?:shadow|drop-shadow)(?:-|$)/u.test(word)
      ? `a shadow: ${word}`
      : undefined,
  (word) =>
    /^(?:bg-linear|bg-radial|bg-conic|bg-gradient)-/u.test(word)
      ? `a gradient: ${word}`
      : undefined,
  (word) =>
    /^(?:from|via|to)-[a-z(]/u.test(word)
      ? `a gradient stop: ${word}`
      : undefined,
  (word) =>
    /^rounded(?:-|$)/u.test(word) &&
    !/^rounded(?:-(?:[tblrse]|t[lr]|b[lr]|s[se]|e[se]))?-(?:sm|md|full|none)$/u.test(
      word
    )
      ? `a radius: ${word}`
      : undefined,
  (word, name) => {
    const pixels = sizeOf(word);

    return pixels === undefined || sizes.has(pixels) || markFiles.has(name)
      ? undefined
      : `a type size outside DESIGN.md: ${word}`;
  },
];

const findings = (name: string, source: string): readonly string[] => [
  ...sourceRules.flatMap(([reason, broken]) =>
    broken(source, name) ? [reason] : []
  ),
  ...words(source)
    .map(utility)
    .flatMap((word) => wordRules.flatMap((rule) => rule(word, name) ?? [])),
];

describe("the blocks keep to DESIGN.md", () => {
  it("reads the blocks", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("$name uses tokens only", ({ name, source }) => {
    expect(findings(name, source)).toStrictEqual([]);
  });

  it.each(blockSlugs)("%s has a render test", (slug) => {
    expect(
      existsSync(path.join(import.meta.dirname, `blocks/${slug}.test.tsx`))
    ).toBe(true);
  });

  it.each([
    ['<div className="dark:bg-card" />', "a dark: class"],
    ['<div className="shadow-sm" />', "a shadow: shadow-sm"],
    ['<div className="hover:shadow-md" />', "a shadow: shadow-md"],
    ['<div className="bg-[#ffffff]" />', "a hex colour"],
    ['<div className="text-neutral-600" />', "a Tailwind palette colour"],
    ['<div className="text-white" />', "a Tailwind palette colour"],
    ['<div className="bg-linear-to-r" />', "a gradient: bg-linear-to-r"],
    ['<div className="from-brand" />', "a gradient stop: from-brand"],
    ['<div className="rounded-2xl" />', "a radius: rounded-2xl"],
    ['<div className="rounded" />', "a radius: rounded"],
    ['<div className="text-xl" />', "a type size outside DESIGN.md: text-xl"],
    [
      '<div className="sm:text-[20px]" />',
      "a type size outside DESIGN.md: text-[20px]",
    ],
    ['<p className="uppercase" />', "upper case outside a table header"],
    [
      'import { BrandField } from "../../components/brand-field";',
      "the brand field outside the hero, the closing band and covers",
    ],
    [
      'import { Link } from "next/link";',
      "an import that ties the block to one app",
    ],
    [
      'import { rateCard } from "peal-contract/rate-card";',
      "an import that ties the block to one app",
    ],
  ])("refuses %s", (source, reason) => {
    expect(findings("text/specimen", source)).toContain(reason);
  });

  it.each([
    '<th className="text-xs uppercase" />',
    '<div className="rounded-md rounded-t-sm rounded-full" />',
    '<div className="text-[13px] sm:text-[40px] text-sm" />',
    '<div className="bg-(image:--hatch) top-0 inset-x-0" />',
  ])("accepts %s", (source) => {
    expect(findings("text/specimen", source)).toStrictEqual([]);
  });
});
