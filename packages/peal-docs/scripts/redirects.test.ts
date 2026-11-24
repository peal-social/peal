// The docs' redirects land on a page, and none hides one: no source is an
// address the docs serve a page at, and every target is one (or another
// site). The reference's pages are the contract's document's, by
// Blume's rules (blume/src/openapi/model.ts: `tagSlugger` and
// `operationKey`), the guides' from docs/.
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { openApiDocument } from "peal-contract/openapi-document";

import { redirects } from "../redirects.ts";

const root = path.join(import.meta.dirname, "..");

const caseBoundary = /(?<before>[\p{Ll}\p{N}])(?<capital>\p{Lu})/gu;
const acronymBoundary = /(?<acronym>\p{Lu})(?<word>\p{Lu}\p{Ll})/gu;

// A name's slug as Blume writes it: word boundaries hyphenated, then
// lowercased with every run of other characters one hyphen.
const slugOf = (name: string): string =>
  name
    .replaceAll(caseBoundary, "$<before>-$<capital>")
    .replaceAll(acronymBoundary, "$<acronym>-$<word>")
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(/\p{Cf}/gu, "")
    .replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

// Every reference page: /reference/<tag>/<operation>.
const referencePages = (): Set<string> =>
  new Set(
    Object.values(openApiDocument().paths).flatMap((item) =>
      [item.get, item.put, item.post, item.delete, item.patch].flatMap(
        (operation) =>
          operation === undefined
            ? []
            : [
                `/reference/${slugOf(operation.tags[0])}/${slugOf(operation.operationId)}`,
              ]
      )
    )
  );

// Every page of docs/ by its address: docs/guides/index.mdx is /guides.
const guidePages = async (): Promise<Set<string>> => {
  const files = await readdir(path.join(root, "docs"), { recursive: true });

  return new Set(
    files
      .filter((file) => file.endsWith(".mdx"))
      .map(
        (file) =>
          `/${file.replace(/\.mdx$/u, "").replace(/(?:^|\/)index$/u, "")}`
            .replace(/\/$/u, "")
            .replace(/^$/u, "/") || "/"
      )
  );
};

// The page a target names, without its #anchor.
const pageOf = (to: string): string => to.split("#")[0] ?? to;

// A guide's file from its address, `index.mdx` for a folder's own page:
// /guides/workspace is docs/guides/workspace/index.mdx.
const fileOf = (page: string): string => {
  const direct = path.join(root, "docs", `${page}.mdx`);

  return existsSync(direct)
    ? direct
    : path.join(root, "docs", page, "index.mdx");
};

describe("the docs' redirects", () => {
  it("send every old address to a page the docs serve, and hide none", async () => {
    const reference = referencePages();
    const guides = await guidePages();

    // The reference is rendered in both languages.
    const served = new Set([
      ...guides,
      ...reference,
      ...[...reference].map((page) => `/fr${page}`),
    ]);

    // The public API's operations, one page each.
    expect(reference.size).toBeGreaterThan(200);
    expect(
      redirects.filter(({ from }) => served.has(from)).map(({ from }) => from)
    ).toEqual([]);
    expect(
      redirects
        .filter(({ to }) => to.startsWith("/") && !served.has(pageOf(to)))
        .map(({ to }) => to)
    ).toEqual([]);
  });

  it("sends an address with an #anchor to a section its page has", async () => {
    const anchored = redirects.flatMap(({ to }) => {
      const [page = "", anchor] = to.split("#");

      return to.startsWith("/") && anchor !== undefined
        ? [{ anchor, page, to }]
        : [];
    });

    const texts = await Promise.all(
      anchored.map(async ({ page }) => await Bun.file(fileOf(page)).text())
    );

    const missing = anchored.flatMap(({ anchor, to }, at) =>
      texts[at]?.includes(`[#${anchor}]`) === true ? [] : [to]
    );

    expect(anchored.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("names each old address once", () => {
    const sources = redirects.map(({ from }) => from);

    expect(sources.filter((from, at) => sources.indexOf(from) !== at)).toEqual(
      []
    );
  });

  it("uses no pattern, which a static host would not answer", () => {
    expect(
      redirects.filter(({ from }) => from.includes("*")).map(({ from }) => from)
    ).toEqual([]);
  });
});
