import { Match } from "effect";

import type {
  ArticleBody,
  Block,
  Inline,
  ListItem,
  Mark,
  TextNode,
} from "./article-body.ts";
import type { ImageAddresses } from "./article-html.ts";

// The one place an article's Markdown is written, for the sites that take
// Markdown rather than HTML (Dev.to, Hashnode): from the body's document,
// node by node, as `article-html.ts` writes HTML. Every text a member
// typed stays text there:
//
// - the characters Markdown reads as syntax are escaped with a backslash,
//   which CommonMark allows before any ASCII punctuation;
// - `<`, `>`, `&`, `{` and `}` are written as HTML entities, so no tag,
//   entity or template tag reaches the page: Dev.to's renderer runs its
//   Liquid tags (`{% … %}`, `{{ … }}`) over the HTML Markdown made, where
//   a backslash no longer is;
// - `[` is escaped, so neither a link nor an embed (`%[…]`) is made of
//   what a member typed.
//
// Code is written as code, fenced longer than any run of backticks it
// holds; both sites keep code as it is (Dev.to escapes its Liquid tags
// there itself). A mark is written around its text with the spaces at
// its edges outside, as Markdown needs; marks nest in one order, the
// link outermost.

const entities = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ["{", "&#123;"],
  ["}", "&#125;"],
]);

/** Text as Markdown shows it, and nothing else. */
export const escapeMarkdown = (text: string): string =>
  text
    .replaceAll(/\r\n?|\n/gu, " ")
    .replaceAll(
      /[&<>{}]|[!#$()*+\-.=[\\\]^_`|~]/gu,
      (character) => entities.get(character) ?? `\\${character}`
    );

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

const delimiters: Readonly<
  Record<Exclude<Mark["type"], "code" | "link">, string>
> = { bold: "**", italic: "*", strike: "~~" };

const marked = (mark: Mark, inner: string): string =>
  Match.value(mark).pipe(
    Match.discriminatorsExhaustive("type")({
      bold: () => `${delimiters.bold}${inner}${delimiters.bold}`,
      code: () => inner,
      italic: () => `${delimiters.italic}${inner}${delimiters.italic}`,
      link: ({ attrs }) => `[${inner}](${destination(attrs.href)})`,
      strike: () => `${delimiters.strike}${inner}${delimiters.strike}`,
    })
  );

// A text node with no mark left to write but code, which is the text
// itself as a code span.
const leafOf = (node: TextNode, marks: readonly Mark[]): string =>
  marks.some((mark) => mark.type === "code")
    ? codeSpan(node.text.replaceAll(/\r\n?|\n/gu, " "))
    : escapeMarkdown(node.text);

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

// The content of one run of nodes that share `depth` marks: those marks
// are written around it by the caller.
const inlineRun = (
  nodes: readonly Inline[],
  depth: number,
  lineBreak: string
): string => {
  let written = "";
  let at = 0;

  while (at < nodes.length) {
    const node = nodes[at];

    if (node === undefined) {
      break;
    }

    if (node.type === "hardBreak") {
      written += lineBreak;
      at += 1;
      continue;
    }

    const marks = sortedMarks(node);
    const mark = marks[depth];

    if (mark === undefined) {
      written += leafOf(node, marks);
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

    const inner = inlineRun(nodes.slice(at, end), depth + 1, lineBreak);
    const leading = /^\s*/u.exec(inner)?.[0] ?? "";
    const trailing = /\s*$/u.exec(inner)?.[0] ?? "";
    const core = inner.slice(leading.length, inner.length - trailing.length);

    written +=
      core === "" ? inner : `${leading}${marked(mark, core)}${trailing}`;
    at = end;
  }

  return written;
};

const inlines = (content: readonly Inline[] | undefined, lineBreak = "\\\n") =>
  inlineRun(content ?? [], 0, lineBreak);

const indented = (text: string, by: string) =>
  text
    .split("\n")
    .map((line, index) => (index === 0 || line === "" ? line : `${by}${line}`))
    .join("\n");

const blockMarkdown = (block: Block, images: ImageAddresses): string => {
  const children = (blocks: readonly Block[]) =>
    blocks
      .flatMap((child) => {
        const written = blockMarkdown(child, images);

        return written === "" ? [] : [written];
      })
      .join("\n\n");

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
        `${"#".repeat(attrs.level)} ${inlines(content, " ")}`,
      horizontalRule: () => "***",
      // A file the site was not given is left out rather than shown
      // broken.
      image: ({ attrs }) => {
        const source = images.get(attrs.mediaId);

        return source === undefined
          ? ""
          : `![${escapeMarkdown(attrs.alt)}](${destination(source)})`;
      },
      orderedList: ({ attrs, content }) => {
        const start = attrs?.start ?? 1;

        return items(content, (index) => `${start + index}. `);
      },
      paragraph: ({ content }) => inlines(content),
    })
  );
};

/**
 * The body as Markdown, its blocks a blank line apart, its images at the
 * addresses the site gave them.
 */
export const articleMarkdown = (
  body: ArticleBody,
  images: ImageAddresses
): string =>
  body.content
    .flatMap((block) => {
      const written = blockMarkdown(block, images);

      return written === "" ? [] : [written];
    })
    .join("\n\n");
