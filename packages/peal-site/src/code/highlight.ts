import { Option, Schema } from "effect";
import {
  codeTokenKinds,
  encodeHighlighted,
} from "peal-ui/lib/highlighted-code";
import type { CodeRun, CodeTokenKind } from "peal-ui/lib/highlighted-code";
import { createHighlighter } from "shiki";
import type { ThemedToken } from "shiki";

import { pealTheme } from "./theme.ts";

// Code highlighted at build time, in Astro's frontmatter: the page gets
// runs of text with their kind, and no highlighter reaches the browser.

/** The grammars the site's code is written in. */
export const codeGrammars = [
  "bash",
  "csharp",
  "go",
  "java",
  "json",
  "php",
  "python",
  "ruby",
  "rust",
  "typescript",
] as const;

export type CodeGrammar = (typeof codeGrammars)[number];

const highlighter = createHighlighter({
  langs: [...codeGrammars],
  themes: [pealTheme],
});

const decodeKind = Schema.decodeUnknownOption(Schema.Literals(codeTokenKinds));

/** The kind a colour of the theme names, none for plain text. */
const kindOf = (colour: string | undefined): CodeTokenKind | undefined =>
  Option.getOrUndefined(
    decodeKind(
      /^var\(--code-(?<name>[a-z]+)\)$/u.exec(colour ?? "")?.groups?.["name"]
    )
  );

/** A line's tokens as runs, neighbours of one kind joined into one. */
const runsOf = (line: readonly ThemedToken[]): CodeRun[] => {
  const runs: CodeRun[] = [];

  for (const token of line) {
    const kind = kindOf(token.color);
    const last = runs.at(-1);
    // Spaces take no colour, so they join whatever run they follow.
    const blank = token.content.trim() === "";

    if (last !== undefined && (last.kind === kind || blank)) {
      runs[runs.length - 1] = { ...last, text: last.text + token.content };
    } else {
      runs.push(
        kind === undefined
          ? { text: token.content }
          : { kind, text: token.content }
      );
    }
  }

  return runs;
};

/** `code`, highlighted, as a code block's `highlighted` prop. */
export const highlight = async (
  code: string,
  grammar: CodeGrammar
): Promise<string> => {
  const ready = await highlighter;

  const { tokens } = ready.codeToTokens(code, {
    lang: grammar,
    theme: pealTheme.name ?? "",
  });

  return encodeHighlighted(tokens.map((line) => runsOf(line)));
};
