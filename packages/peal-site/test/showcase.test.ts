// The blocks showcase covers every block, and stays off the public site:
// no page outside it imports its synthetic fixtures or a block that waits
// for real content, and with the showcase off, its route builds no page.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { categories } from "../src/showcase/categories.ts";
import { contentPending } from "../src/showcase/content-pending.ts";
import { showcaseIndex, showcasePaths } from "../src/showcase/pages.ts";
import { registry } from "../src/showcase/registry.tsx";

const blocksRoot = path.join(import.meta.dirname, "../../peal-ui/src/blocks");

const sourceRoot = path.join(import.meta.dirname, "../src");

const filesUnder = (root: string, extensions: readonly string[]) =>
  readdirSync(root, { recursive: true })
    .map(String)
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .map((file) => file.split(path.sep).join("/"));

const blockSlugs = filesUnder(blocksRoot, [".tsx"])
  .map((file) => file.replace(/\.tsx$/u, ""))
  .toSorted();

// The site's own files but the showcase's: its folder and its route.
const publicFiles = filesUnder(sourceRoot, [".astro", ".ts", ".tsx"]).filter(
  (file) => !file.startsWith("showcase/") && !file.startsWith("pages/blocks/")
);

const importsOf = (source: string) =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*"(?<specifier>[^"]+)"/gu)].map(
    (match) => match.groups?.["specifier"] ?? ""
  );

// What a public file may not import: the showcase, or a block that has no
// real content yet.
const refused = (specifier: string, pending: readonly string[]) =>
  /(?:^|\/)showcase\//u.test(specifier) ||
  pending.some((slug) => specifier === `peal-ui/blocks/${slug}`);

describe("the blocks showcase", () => {
  it("finds the blocks", () => {
    expect(blockSlugs.length).toBeGreaterThan(0);
  });

  it("has one entry per block, and only blocks", () => {
    expect(registry.map((entry) => entry.slug).toSorted()).toStrictEqual(
      blockSlugs
    );
  });

  it.each(registry.map((entry) => [entry.slug, entry] as const))(
    "shows %s in at least one specimen, under a kind asked for",
    (_slug, entry) => {
      expect(entry.specimens.length).toBeGreaterThan(0);
      expect(entry.categories.length).toBeGreaterThan(0);
      expect(
        entry.categories.every((category) => categories.includes(category))
      ).toBe(true);
    }
  );

  it("names its specimens apart", () => {
    for (const entry of registry) {
      const names = entry.specimens.map((specimen) => specimen.name);

      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("lists every kind asked for, with a block or a note", () => {
    const index = showcaseIndex();

    expect(index.map((group) => group.category)).toStrictEqual([...categories]);

    for (const group of index) {
      expect(group.blocks.length > 0 || group.note !== undefined).toBe(true);
    }
  });

  it("holds only blocks in its content-pending list", () => {
    for (const slug of contentPending) {
      expect(blockSlugs).toContain(slug);
    }
  });

  it("reads the site's public files", () => {
    expect(publicFiles).toContain("pages/[...locale]/index.astro");
    expect(publicFiles).toContain("layouts/base.astro");
  });

  it.each(publicFiles)(
    "keeps %s free of the showcase and of content-pending blocks",
    (file) => {
      const source = readFileSync(path.join(sourceRoot, file), "utf-8");

      expect(
        importsOf(source).filter((specifier) =>
          refused(specifier, contentPending)
        )
      ).toStrictEqual([]);
    }
  );

  it("refuses the fixtures and a pending block", () => {
    expect(refused("../../showcase/fixtures.ts", [])).toBe(true);
    expect(
      refused("peal-ui/blocks/proof/quote-grid", ["proof/quote-grid"])
    ).toBe(true);
    expect(refused("peal-ui/blocks/text/statement", ["proof/quote-grid"])).toBe(
      false
    );
  });

  it("builds no page when off, and the index and every block when on", () => {
    expect(showcasePaths(false)).toStrictEqual([]);
    expect(showcasePaths(true)).toHaveLength(registry.length + 1);
    expect(showcasePaths(true)[0]).toStrictEqual({
      params: { block: undefined },
    });
  });
});
