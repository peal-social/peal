// Highlighted code as one string, the shape a code block's props cross from
// an Astro page to a React island in. As objects, each run of text would
// cost dozens of bytes of JSON and HTML escaping; here it costs four: a
// separator and a letter for its kind. Lines are separated by a newline,
// runs by U+2063 (an invisible separator, which code never holds), and each
// run starts with its kind's letter, `.` for plain text.

/**
 * What a run of code can be, each with its colour (DESIGN.md, Code) in a
 * `--code-<kind>` variable; plain text, names and calls have none.
 */
export const codeTokenKinds = [
  "comment",
  "constant",
  "deleted",
  "keyword",
  "punctuation",
  "string",
  "type",
] as const;

export type CodeTokenKind = (typeof codeTokenKinds)[number];

/** A run of code of one kind, or plain. */
export interface CodeRun {
  readonly kind?: CodeTokenKind | undefined;
  readonly text: string;
}

const separator = "⁣";

const plain = ".";

const letters: Readonly<Record<CodeTokenKind, string>> = {
  comment: "c",
  constant: "n",
  deleted: "d",
  keyword: "k",
  punctuation: "p",
  string: "s",
  type: "t",
};

const kinds = new Map(
  codeTokenKinds.map((kind) => [letters[kind], kind] as const)
);

/** Lines of runs as one string; refuses code that holds the separator. */
export const encodeHighlighted = (
  lines: readonly (readonly CodeRun[])[]
): string =>
  lines
    .map((runs) =>
      runs
        .map((run) => {
          if (run.text.includes(separator) || run.text.includes("\n")) {
            throw new Error("A run of code holds a separator or a newline.");
          }

          return `${run.kind === undefined ? plain : letters[run.kind]}${run.text}`;
        })
        .join(separator)
    )
    .join("\n");

/** A run read back, with where it starts in its line, which keys it. */
export interface DecodedRun extends CodeRun {
  readonly offset: number;
}

/** The lines of runs `encodeHighlighted` wrote. */
export const decodeHighlighted = (encoded: string): DecodedRun[][] =>
  encoded.split("\n").map((line) => {
    const runs: DecodedRun[] = [];
    let offset = 0;

    for (const run of line === "" ? [] : line.split(separator)) {
      const kind = kinds.get(run.slice(0, 1));
      const text = run.slice(1);

      runs.push(kind === undefined ? { offset, text } : { kind, offset, text });
      offset += text.length;
    }

    return runs;
  });

/** How many lines the code has, counted from their separators. */
export const highlightedLineCount = (encoded: string): number =>
  encoded.split("\n").length;

/** The plain source, as Copy copies it. */
export const highlightedSource = (encoded: string): string =>
  decodeHighlighted(encoded)
    .map((runs) => runs.map((run) => run.text).join(""))
    .join("\n");
