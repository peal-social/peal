// French typography for the French pages (docs/fr/): a narrow no-break
// space (U+202F) before ; ! ? and inside « », a no-break space (U+00A0)
// before :, and narrow no-break spaces in 5 000, 20 % and 10 €. Blume has no
// Markdown plugin to add them when a page renders, so they live in the files,
// where a plain space would let a line break before the punctuation.
// Code, links' targets, URLs, expressions and anchors are left alone.
//   bun scripts/french-typography.ts          rewrites the pages
//   bun scripts/french-typography.ts --check  fails when one needs it
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const narrow = " ";
const noBreak = " ";

// What a protected span becomes while the text around it is rewritten: a
// private-use character pair around its index, so that a span reads as a
// word ("`code` :" still takes its space) and no rule matches inside it.
const placeholder = (index: number) => `${String(index)}`;

const protectedSpans = [
  /<!--[\s\S]*?-->/gu,
  /`[^`]*`/gu,
  /\]\([^)]*\)/gu,
  /https?:\/\/[^\s)>"]+/gu,
  /\{\{[^}]*\}\}/gu,
  /\{[^{}]*\}/gu,
  /\[#[^\]]+\]/gu,
];

// What may end the word before the punctuation: a letter, a digit, the end
// of emphasis, a quote, a bracket, or a protected span.
const word = String.raw`[\p{L}\p{N})\]»*_"’]`;

const rules: readonly (readonly [RegExp, string])[] = [
  [/«[   ]?/gu, `«${narrow}`],
  [/[   ]?»/gu, `${narrow}»`],
  [/ (?<mark>[;!?])(?=\s|$)/gu, `${narrow}$<mark>`],
  [
    new RegExp(`(?<before>${word})(?<mark>[;!?])(?=\\s|$)`, "gu"),
    `$<before>${narrow}$<mark>`,
  ],
  [/ :(?=\s|$)/gu, `${noBreak}:`],
  [new RegExp(`(?<before>${word}):(?=\\s|$)`, "gu"), `$<before>${noBreak}:`],
  [/(?<digit>\d) (?=\d{3}(?!\d))/gu, `$<digit>${narrow}`],
  [/(?<digit>\d) (?<unit>[%€])/gu, `$<digit>${narrow}$<unit>`],
];

const typeset = (text: string): string => {
  const kept: string[] = [];
  let masked = text;

  for (const pattern of protectedSpans) {
    masked = masked.replaceAll(pattern, (span) => {
      kept.push(span);

      return placeholder(kept.length - 1);
    });
  }

  for (const [pattern, replacement] of rules) {
    masked = masked.replaceAll(pattern, replacement);
  }

  return masked.replaceAll(
    /(?<index>\d+)/gu,
    (_match, index: string) => kept[Number(index)] ?? ""
  );
};

// Frontmatter: only the values of the keys a reader sees.
const typesetFrontmatterLine = (line: string): string => {
  const field =
    /^(?<key>\s*(?:title|description|label):\s?)(?<value>.*)$/u.exec(
      line
    )?.groups;

  return field === undefined
    ? line
    : `${field["key"] ?? ""}${typeset(field["value"] ?? "")}`;
};

export const frenchTypography = (source: string): string => {
  const lines = source.split("\n");
  let inFrontmatter = lines[0] === "---";
  let fence: string | undefined;

  return lines
    .map((line, index) => {
      if (inFrontmatter) {
        if (index > 0 && line === "---") {
          inFrontmatter = false;

          return line;
        }

        return typesetFrontmatterLine(line);
      }

      const opening = /^\s*(?<marks>`{3,}|~{3,})/u.exec(line)?.groups?.[
        "marks"
      ];

      if (fence !== undefined) {
        if (opening?.startsWith(fence) === true) {
          fence = undefined;
        }

        return line;
      }

      if (opening !== undefined) {
        fence = opening;

        return line;
      }

      if (/^\s*(?:import|export)\s/u.test(line)) {
        return line;
      }

      return typeset(line);
    })
    .join("\n");
};

const pages = async (folder: string): Promise<string[]> => {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .toSorted();
};

const main = async () => {
  const check = process.argv.includes("--check");
  const folder = path.join(import.meta.dirname, "..", "docs", "fr");
  const files = await pages(folder);

  const results = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf-8");
      const set = frenchTypography(source);

      if (set === source) {
        return null;
      }

      if (!check) {
        await writeFile(file, set);
      }

      return path.relative(folder, file);
    })
  );

  const changed = results.filter((file) => file !== null);

  if (check && changed.length > 0) {
    console.error(
      `These French pages need French spacing; run bun scripts/french-typography.ts:\n${changed.join("\n")}`
    );
    process.exitCode = 1;

    return;
  }

  console.log(
    check
      ? "French typography: every page is set."
      : `French typography: ${String(changed.length)} page(s) set.`
  );
};

if (import.meta.main) {
  await main();
}
