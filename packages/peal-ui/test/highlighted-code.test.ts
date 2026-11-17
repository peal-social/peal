// Highlighted code survives its trip through one string: every run comes
// back with its kind and its text, and the plain source is the text alone.
import { describe, expect, it } from "vitest";

import {
  decodeHighlighted,
  encodeHighlighted,
  highlightedSource,
} from "../src/lib/highlighted-code";

const lines = [
  [
    { kind: "keyword", text: "const" },
    { text: " peal " },
    { kind: "punctuation", text: "=" },
    { kind: "string", text: ' "peal-sdk"' },
  ],
  [],
  [{ kind: "comment", text: "// done" }],
] as const;

describe("highlighted code", () => {
  it("reads back each run's kind, text and offset", () => {
    expect(decodeHighlighted(encodeHighlighted(lines))).toStrictEqual([
      [
        { kind: "keyword", offset: 0, text: "const" },
        { offset: 5, text: " peal " },
        { kind: "punctuation", offset: 11, text: "=" },
        { kind: "string", offset: 12, text: ' "peal-sdk"' },
      ],
      [],
      [{ kind: "comment", offset: 0, text: "// done" }],
    ]);
  });

  it("gives back the plain source", () => {
    expect(highlightedSource(encodeHighlighted(lines))).toBe(
      'const peal = "peal-sdk"\n\n// done'
    );
  });

  it("refuses a run that holds a newline", () => {
    expect(() => encodeHighlighted([[{ text: "a\nb" }]])).toThrow(
      "separator or a newline"
    );
  });
});
