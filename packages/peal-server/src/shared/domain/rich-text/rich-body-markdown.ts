import { Match } from "effect";

import type { ImageAddresses } from "./rich-body-html.ts";
import type {
  ArticleBody,
  Block,
  Inline,
  ListItem,
  Mark,
  TextNode,
} from "./rich-body.ts";

// The one place an article's Markdown is written, for the sites that take
// Markdown rather than HTML (DEV, Hashnode): from the body's document,
// node by node, as `rich-body-html.ts` writes HTML. Every text a member
// typed stays text there:
//
// - the characters Markdown reads as syntax are escaped with a backslash;
// - `<`, `>` and `&` are written as HTML entities, so no tag or entity
//   reaches the page;
// - `[` is escaped, so neither a link nor an embed (`%[…]`) is made of
//   what a member typed.
//
// Two dialects: CommonMark's (Hashnode), and Forem's (DEV), whose
// renderer is Redcarpet, then a sanitiser, then Liquid over the HTML, then
// a pass that links `@name`s (forem/forem `MarkdownProcessor::Parser`,
// `Html::Parser`). On DEV, then:
//
// - each `{` is written as Liquid's own text, `{{ '{' }}`: an entity is
//   decoded by the sanitiser before Liquid reads it, and a `{% raw %}`
//   block can be closed by what it holds; a lone `}` is no tag, and stays;
// - only the characters Redcarpet un-escapes are escaped (not `$`), and a
//   hard break is two spaces before the line's end, Redcarpet's;
// - a word joiner follows each `@`, so no member is mentioned.
//
// Code is written as code, fenced longer than any run of backticks it
// holds; both sites keep code as it is (DEV escapes its Liquid tags there
// itself). A mark is written around its text with the spaces at its edges
// outside; where its delimiters would not hold (next to a letter, as a
// mark ending in punctuation before one, or on DEV inside a word) it is
// written as HTML instead. Marks nest in one order, the link outermost. A
// paragraph's leading spaces, which would make code, are dropped, and two
// lists in a row are kept apart by an HTML comment.

/** The Markdown a site reads: CommonMark, or Forem's (DEV). */
export type MarkdownDialect = "commonmark" | "forem";

const commonmarkEscapes = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ["{", "&#123;"],
  ["}", "&#125;"],
]);

const foremEscapes = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ["{", "{{ '{' }}"],
  ["`", "&#96;"],
]);

const wordJoiner = "\u2060";

/** Text as the dialect's Markdown shows it, and nothing else. */
export const escapeMarkdown = (
  text: string,
  dialect: MarkdownDialect = "commonmark"
): string => {
  const flat = text.replaceAll(/\r\n?|\n/gu, " ");

  if (dialect === "commonmark") {
    return flat.replaceAll(
      /[&<>{}]|[!#$()*+\-.=[\\\]^_`|~]/gu,
      (character) => commonmarkEscapes.get(character) ?? `\\${character}`
    );
  }

  return flat.replaceAll(
    /(?<before>[\p{L}\p{N}_]?)@|[&<>{`]|[!#():*+\-.=[\\\]^_|~]/gu,
    (character, before: string | undefined) => {
      if (!character.endsWith("@")) {
        return foremEscapes.get(character) ?? `\\${character}`;
      }

      // Forem mentions an `@` that follows no word character (`\B@`):
      // a word joiner breaks it. Any other, as an email's, is an entity,
      // which Redcarpet's autolink does not read and readers copy clean.
      return before === undefined || before === ""
        ? `@${wordJoiner}`
        : `${escapeMarkdown(before, "forem")}&#64;`;
    }
  );
};

// An address as a link's or an image's destination: what the WHATWG
// parser writes, with what would end or break the destination encoded.
const destination = (address: string) =>
  (URL.parse(address)?.href ?? "")
    .replaceAll("(", "%28")
    .replaceAll(")", "%29")
    .replaceAll(" ", "%20")
    .replaceAll("<", "%3C")
    .replaceAll(">", "%3E")
    .replaceAll("{", "%7B")
    .replaceAll("}", "%7D")
    .replaceAll("\\", "%5C");

const longestRun = (text: string, character: string) =>
  Math.max(
    0,
    ...[...text.matchAll(new RegExp(`${character}+`, "gu"))].map(
      ([run]) => run.length
    )
  );

const codeSpan = (text: string) => {
  const fence = "`".repeat(longestRun(text, "`") + 1);

  const padded =
    text.startsWith("`") || text.endsWith("`") || fence.length > 1
      ? ` ${text} `
      : text;

  return `${fence}${padded}${fence}`;
};

const markOrder: readonly Mark["type"][] = [
  "link",
  "bold",
  "italic",
  "strike",
  "code",
];

type DelimitedMark = Exclude<Mark["type"], "code" | "link">;

const delimiters: Readonly<Record<DelimitedMark, string>> = {
  bold: "**",
  italic: "*",
  strike: "~~",
};

const tags: Readonly<Record<DelimitedMark, string>> = {
  bold: "strong",
  italic: "em",
  strike: "del",
};

const isWord = (character: string | undefined) =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character);

const isPunctuation = (character: string | undefined) =>
  character !== undefined && !isWord(character) && !/\s/u.test(character);

// Whether a mark's delimiters would not hold where it stands: in
// CommonMark, one that begins or ends in punctuation beside a letter; in
// Forem's, which takes no emphasis inside a word, one beside a letter.
const delimitersFail = (
  dialect: MarkdownDialect,
  core: string,
  before: string | undefined,
  after: string | undefined
) =>
  dialect === "forem"
    ? isWord(before) || isWord(after)
    : (isPunctuation(core[0]) && isWord(before)) ||
      (isPunctuation(core.at(-1)) && isWord(after));

const marked = (mark: Mark, inner: string, asHtml: boolean): string =>
  Match.value(mark).pipe(
    Match.discriminatorsExhaustive("type")({
      bold: () => around("bold", inner, asHtml),
      code: () => inner,
      italic: () => around("italic", inner, asHtml),
      link: ({ attrs }) => `[${inner}](${destination(attrs.href)})`,
      strike: () => around("strike", inner, asHtml),
    })
  );

const around = (mark: DelimitedMark, inner: string, asHtml: boolean) =>
  asHtml
    ? `<${tags[mark]}>${inner}</${tags[mark]}>`
    : `${delimiters[mark]}${inner}${delimiters[mark]}`;

// A text node with no mark left to write but code, which is the text
// itself as a code span.
const leafOf = (
  node: TextNode,
  marks: readonly Mark[],
  dialect: MarkdownDialect
): string =>
  marks.some((mark) => mark.type === "code")
    ? codeSpan(node.text.replaceAll(/\r\n?|\n/gu, " "))
    : escapeMarkdown(node.text, dialect);

const sortedMarks = (node: Inline) =>
  node.type === "text"
    ? (node.marks ?? []).toSorted(
        (left, right) =>
          markOrder.indexOf(left.type) - markOrder.indexOf(right.type)
      )
    : [];

const sameMark = (left: Mark, right: Mark) =>
  left.type === right.type &&
  (left.type !== "link" ||
    (right.type === "link" && left.attrs.href === right.attrs.href));

// What a run writes, before marks are told how to close: text, or a mark
// around its core with the spaces at its edges.
type Piece =
  | { readonly _tag: "text"; readonly text: string }
  | {
      readonly _tag: "mark";
      readonly core: string;
      readonly leading: string;
      readonly mark: Mark;
      readonly trailing: string;
    };

const pieceEdge = (
  piece: Piece | undefined,
  edge: "first" | "last"
): string | undefined => {
  if (piece === undefined) {
    return piece;
  }

  if (piece._tag === "text") {
    return edge === "first" ? piece.text[0] : piece.text.at(-1);
  }

  const space = edge === "first" ? piece.leading : piece.trailing;

  // A mark's own edge is a delimiter or a tag: never a letter.
  return space === "" ? "*" : space[0];
};

// The content of one run of nodes that share `depth` marks: those marks
// are written around it by the caller.
const inlineRun = (
  nodes: readonly Inline[],
  depth: number,
  lineBreak: string,
  dialect: MarkdownDialect
): string => {
  const pieces: Piece[] = [];
  let at = 0;

  while (at < nodes.length) {
    const node = nodes[at];

    if (node === undefined) {
      break;
    }

    if (node.type === "hardBreak") {
      pieces.push({ _tag: "text", text: lineBreak });
      at += 1;
      continue;
    }

    const marks = sortedMarks(node);
    const mark = marks[depth];

    if (mark === undefined) {
      pieces.push({ _tag: "text", text: leafOf(node, marks, dialect) });
      at += 1;
      continue;
    }

    // Every following node under the same mark goes inside it.
    let end = at + 1;

    while (end < nodes.length) {
      const next = nodes[end];

      if (next === undefined || next.type === "hardBreak") {
        break;
      }

      const nextMark = sortedMarks(next)[depth];

      if (nextMark === undefined || !sameMark(mark, nextMark)) {
        break;
      }

      end += 1;
    }

    const inner = inlineRun(
      nodes.slice(at, end),
      depth + 1,
      lineBreak,
      dialect
    );

    const leading = /^\s*/u.exec(inner)?.[0] ?? "";
    const trailing = /\s*$/u.exec(inner)?.[0] ?? "";
    const core = inner.slice(leading.length, inner.length - trailing.length);

    pieces.push(
      core === ""
        ? { _tag: "text", text: inner }
        : { _tag: "mark", core, leading, mark, trailing }
    );
    at = end;
  }

  return pieces
    .map((piece, index) => {
      if (piece._tag === "text") {
        return piece.text;
      }

      const before =
        piece.leading === ""
          ? pieceEdge(pieces[index - 1], "last")
          : piece.leading;

      const after =
        piece.trailing === ""
          ? pieceEdge(pieces[index + 1], "first")
          : piece.trailing;

      const asHtml = delimitersFail(dialect, piece.core, before, after);

      return `${piece.leading}${marked(piece.mark, piece.core, asHtml)}${piece.trailing}`;
    })
    .join("");
};

const inlines = (
  content: readonly Inline[] | undefined,
  lineBreak: string,
  dialect: MarkdownDialect
) =>
  // Leading spaces would make the block code.
  inlineRun(content ?? [], 0, lineBreak, dialect).trimStart();

const indented = (text: string, by: string) =>
  text
    .split("\n")
    .map((line, index) => (index === 0 || line === "" ? line : `${by}${line}`))
    .join("\n");

const isList = (block: Block) =>
  block.type === "bulletList" || block.type === "orderedList";

// Blocks a blank line apart; two lists of a kind in a row, which Markdown
// would join, an HTML comment apart.
const joined = (
  blocks: readonly Block[],
  images: ImageAddresses,
  dialect: MarkdownDialect
): string => {
  const written: string[] = [];
  let previous: Block | undefined;

  for (const block of blocks) {
    const markdown = blockMarkdown(block, images, dialect);

    if (markdown === "") {
      continue;
    }

    if (isList(block) && previous?.type === block.type) {
      written.push("<!-- -->");
    }

    written.push(markdown);
    previous = block;
  }

  return written.join("\n\n");
};

const blockMarkdown = (
  block: Block,
  images: ImageAddresses,
  dialect: MarkdownDialect
): string => {
  const children = (blocks: readonly Block[]) =>
    joined(blocks, images, dialect);

  const lineBreak = dialect === "forem" ? "  \n" : "\\\n";

  const items = (
    list: readonly ListItem[],
    marker: (index: number) => string
  ) =>
    list
      .map((item, index) => {
        const prefix = marker(index);

        return `${prefix}${indented(children(item.content), " ".repeat(prefix.length))}`;
      })
      .join("\n");

  return Match.value(block).pipe(
    Match.discriminatorsExhaustive("type")({
      blockquote: ({ content }) =>
        children(content)
          .split("\n")
          .map((line) => (line === "" ? ">" : `> ${line}`))
          .join("\n"),
      bulletList: ({ content }) => items(content, () => "- "),
      codeBlock: ({ content }) => {
        const code = (content ?? []).map(({ text }) => text).join("");
        const fence = "`".repeat(Math.max(3, longestRun(code, "`") + 1));

        return `${fence}\n${code}\n${fence}`;
      },
      heading: ({ attrs, content }) =>
        `${"#".repeat(attrs.level)} ${inlines(content, " ", dialect)}`,
      horizontalRule: () => "***",
      // A file the site was not given is left out rather than shown
      // broken.
      image: ({ attrs }) => {
        const source = images.get(attrs.mediaId);

        return source === undefined
          ? ""
          : `![${escapeMarkdown(attrs.alt, dialect)}](${destination(source)})`;
      },
      orderedList: ({ attrs, content }) => {
        const start = attrs?.start ?? 1;

        return items(content, (index) => `${start + index}. `);
      },
      paragraph: ({ content }) => inlines(content, lineBreak, dialect),
    })
  );
};

/**
 * The body as the dialect's Markdown, its blocks a blank line apart, its
 * images at the addresses the site gave them.
 */
export const articleMarkdown = (
  body: ArticleBody,
  images: ImageAddresses,
  dialect: MarkdownDialect = "commonmark"
): string => joined(body.content, images, dialect);
