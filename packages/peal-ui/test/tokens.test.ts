// DESIGN.md and tokens.css say the same thing: every colour DESIGN.md gives a
// token, and the radius, is the value tokens.css holds. The web app, the docs
// and the site all read tokens.css, so this keeps the three from drifting
// from the design and from each other.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const design = readFileSync(
  path.join(import.meta.dirname, "../../../DESIGN.md"),
  "utf-8"
);

const tokensFile = readFileSync(
  path.join(import.meta.dirname, "../src/styles/tokens.css"),
  "utf-8"
);

const tokens = new Map(
  [...tokensFile.matchAll(/--(?<name>[a-z0-9-]+):\s*(?<value>[^;]+);/gu)].map(
    (match) => [
      match.groups?.["name"] ?? "",
      // The formatter breaks a long value, such as a gradient, over lines.
      (match.groups?.["value"] ?? "")
        .replaceAll(/\s+/gu, " ")
        .replaceAll("( ", "(")
        .replaceAll(" )", ")")
        .trim()
        .toLowerCase(),
    ]
  )
);

// The first hex colour DESIGN.md writes after `prefix`, lower-cased.
const colourAfter = (prefix: RegExp) =>
  new RegExp(`${prefix.source}\`(?<hex>#[0-9A-F]{6})\``, "mu")
    .exec(design)
    ?.groups?.["hex"]?.toLowerCase();

// The rows of the Neutrals table: `background` | `#FAFAF9`, and rows naming
// two tokens, `card`, `popover` | `#FFFFFF`.
const neutralRows = [
  ...design.matchAll(
    /^\| (?<names>(?:`[a-z-]+`(?:, )?)+) +\| `(?<hex>#[0-9A-F]{6})` +\|/gmu
  ),
].flatMap((row) =>
  [...(row.groups?.["names"] ?? "").matchAll(/`(?<name>[a-z-]+)`/gu)].map(
    (token) => ({
      name: token.groups?.["name"] ?? "",
      value: (row.groups?.["hex"] ?? "").toLowerCase(),
    })
  )
);

// The rows of the Brand field's glows table: | Blue | `blue` | `#415EEE` |
// 0.55 | 0.32 | 50% 55% | 0.9 | 0.07 | normal |, sizes and blur in `--m`.
const glowRows = [
  ...design.matchAll(
    /^\| [A-Z][a-z ]+ +\| `(?<token>[a-z-]+)` +\| `(?<colour>#[0-9A-F]{6})` +\| (?<width>[\d.]+) +\| (?<height>[\d.]+) +\| (?<x>-?\d+%) (?<y>-?\d+%) +\| (?<opacity>[\d.]+) +\| (?<blur>[\d.]+) +\| (?<blend>[a-z-]+) +\|$/gmu
  ),
].map(({ groups }) => ({
  blend: groups?.["blend"] ?? "",
  blur: Number(groups?.["blur"]),
  colour: (groups?.["colour"] ?? "").toLowerCase(),
  height: Number(groups?.["height"]),
  opacity: Number(groups?.["opacity"]),
  token: groups?.["token"] ?? "",
  width: Number(groups?.["width"]),
  x: groups?.["x"] ?? "",
  y: groups?.["y"] ?? "",
}));

// The rows of the Code table: | Keywords | `code-keyword` | `#2F47C9` |
// Blue text | 6.7:1 |, the last cell the colour's contrast on `muted`.
const codeRows = [
  ...design.matchAll(
    /^\| [A-Z][^|]+ \| `(?<token>code-[a-z]+)` +\| `(?<hex>#[0-9A-F]{6})` +\| [^|]+ \| (?<ratio>\d+\.\d):1 +\|$/gmu
  ),
].map(({ groups }) => ({
  hex: (groups?.["hex"] ?? "").toLowerCase(),
  ratio: Number(groups?.["ratio"]),
  token: groups?.["token"] ?? "",
}));

// WCAG's relative luminance of a `#rrggbb` colour.
const luminance = (hex: string) => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;

    return channel <= 0.040_45
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

// WCAG's contrast ratio of two colours, the lighter one first.
const contrast = (first: string, second: string) => {
  const [lighter = 0, darker = 0] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a
  );

  return (lighter + 0.05) / (darker + 0.05);
};

// DESIGN.md without its Code section: the palette syntax colours come from.
const palette = design
  .replace(/^### Code$[\s\S]*?(?=^## )/mu, "")
  .toLowerCase();

describe("DESIGN.md and tokens.css", () => {
  it("reads the Neutrals table", () => {
    expect(neutralRows.map((row) => row.name)).toContain("background");
    expect(neutralRows.length).toBeGreaterThanOrEqual(8);
  });

  it.each(neutralRows)("gives --$name the value $value", ({ name, value }) => {
    expect(tokens.get(name)).toBe(value);
  });

  it.each([
    { name: "Blue", token: "brand" },
    { name: "Lavender", token: "lavender" },
    { name: "Yellow", token: "sun" },
  ])("gives $name to --$token", ({ name, token }) => {
    const value = colourAfter(new RegExp(`^\\| ${name} +\\| `, "u"));

    expect(value).toBeDefined();
    expect(tokens.get(token)).toBe(value);
  });

  it("gives blue's hover to --brand-hover", () => {
    expect(tokens.get("brand-hover")).toBe(colourAfter(/Blue's hover is /u));
  });

  it("gives destructive and destructive-text their values", () => {
    expect(tokens.get("destructive")).toBe(colourAfter(/`destructive` is /u));
    expect(tokens.get("destructive-text")).toBe(
      colourAfter(/`destructive-text`,\s+/u)
    );
  });

  it("gives the brand field's base to --field-base", () => {
    const base = /The base is `(?<gradient>radial-gradient\([^`]+\))`/u.exec(
      design
    )?.groups?.["gradient"];

    expect(base).toBeDefined();
    expect(tokens.get("field-base")).toBe(base?.toLowerCase());
  });

  it("reads the brand field's glows", () => {
    expect(glowRows.map((row) => row.token)).toStrictEqual([
      "blue",
      "lavender",
      "lavender-deep",
      "halo",
      "sun",
    ]);
  });

  it.each(glowRows)(
    "gives the $token glow its colour, geometry and blend",
    ({ blend, blur, colour, height, opacity, token, width, x, y }) => {
      const value = (property: string) =>
        tokens.get(`field-${token}-${property}`);

      expect(value("colour")).toBe(colour);
      expect(Number(value("width"))).toBe(width);
      expect(Number(value("height"))).toBe(height);
      expect(value("x")).toBe(x);
      expect(value("y")).toBe(y);
      expect(Number(value("opacity"))).toBe(opacity);
      expect(Number(value("blur"))).toBe(blur);
      expect(value("blend")).toBe(blend);
    }
  );

  it.each([
    { name: "Rails", token: "field-rail" },
    { name: "Ticks", token: "field-tick" },
    { name: "Captions", token: "field-caption" },
  ])("gives the field's $name their white to --$token", ({ name, token }) => {
    const percent = new RegExp(
      `${name} are white at (?<percent>\\d+)%`,
      "u"
    ).exec(design)?.groups?.["percent"];

    expect(percent).toBeDefined();
    expect(tokens.get(token)).toBe(`rgb(255 255 255 / ${percent}%)`);
  });

  it("gives the field's grain its opacity", () => {
    const opacity = /grain at (?<opacity>0?\.\d+) in `soft-light`/u.exec(design)
      ?.groups?.["opacity"];

    expect(opacity).toBeDefined();
    expect(Number(tokens.get("field-grain-opacity"))).toBe(Number(opacity));
  });

  it("reads the Code table", () => {
    expect(codeRows.map((row) => row.token)).toStrictEqual([
      "code-foreground",
      "code-comment",
      "code-punctuation",
      "code-keyword",
      "code-string",
      "code-constant",
      "code-type",
      "code-deleted",
    ]);
  });

  it.each(codeRows)(
    "gives --$token the value $hex, a colour of the palette",
    ({ hex, token }) => {
      expect(tokens.get(token)).toBe(hex);
      expect(palette).toContain(`\`${hex}\``);
    }
  );

  it.each(codeRows)(
    "gives --$token $ratio:1 on muted, past WCAG's 4.5:1",
    ({ hex, ratio }) => {
      const measured = contrast(hex, tokens.get("muted") ?? "");

      expect(measured).toBeGreaterThanOrEqual(4.5);
      expect(Math.floor(measured * 10) / 10).toBe(ratio);
    }
  );

  it("sets code on muted", () => {
    expect(tokens.get("code-background")).toBe(tokens.get("muted"));
  });

  it("gives the radius of controls and cards to --radius", () => {
    const pixels = /Radius: (?<pixels>\d+) px for controls/u.exec(design)
      ?.groups?.["pixels"];

    expect(tokens.get("radius")).toBe(`${Number(pixels) / 16}rem`);
  });
});
