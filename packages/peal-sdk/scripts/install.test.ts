import { describe, expect, it } from "bun:test";
// The install lines the docs and this package's README show are the ones
// scripts/install.ts gives each language's version: a release that bumps
// a version fails here until they follow.
import path from "node:path";

import { installCommand } from "./install.ts";
import { languageNamed, languages } from "./languages.ts";

const packages = path.join(import.meta.dirname, "..", "..");

const read = async (...segments: readonly string[]): Promise<string> =>
  await Bun.file(path.join(packages, ...segments)).text();

const tables = [
  ["the SDKs' README", ["peal-sdk", "README.md"]],
  ["the docs' SDKs page", ["peal-docs", "docs", "developers", "sdks.mdx"]],
  [
    "the French docs' SDKs page",
    ["peal-docs", "docs", "fr", "developers", "sdks.mdx"],
  ],
] as const;

describe.each(tables)("%s", (_name, segments) => {
  it.each(languages.map((language) => [language.name, language] as const))(
    "installs %s's version",
    async (_language, language) => {
      expect(await read(...segments)).toContain(
        `\`${installCommand(language)}\``
      );
    }
  );
});

const quickstarts = [
  ["the API quickstart", ["peal-docs", "docs", "api-quickstart.mdx"]],
  [
    "the French API quickstart",
    ["peal-docs", "docs", "fr", "api-quickstart.mdx"],
  ],
] as const;

describe.each(quickstarts)("%s", (_name, segments) => {
  it("installs the Node.js SDK's version", async () => {
    expect(await read(...segments)).toContain(
      `\`${installCommand(languageNamed("node"))}\``
    );
  });
});
