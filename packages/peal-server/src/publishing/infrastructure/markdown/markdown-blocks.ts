import { Match, Schema } from "effect";
import type { Definition, List, Nodes, Root, RootContent } from "mdast";

import { maxOverrideMedia } from "#publishing/domain/text-override.ts";
import {
  CodeLanguageSchema,
  maxBodyDepth,
  maxBodyNodes,
  maxBodyText,
} from "#shared/domain/rich-text/rich-body.ts";

import type { BlockOut, InlineOut, Piece } from "./markdown-document.ts";
import { isHtmlComment, piecesOf } from "./markdown-inline.ts";
import type { MarkdownProblems } from "./markdown-problems.ts";

// The Markdown tree's blocks as the editor's, walked with a stack, never
// by recursion, each container's blocks a level below it as the
// document's depth counts them (a list's item's blocks a level below the
// list). The walk counts the blocks, the text and the files against a
// body's bounds as it goes, and stops at a level deeper than a body's.

const isLanguage = Schema.is(CodeLanguageSchema);

// Each definition by its identifier, the first one winning, as CommonMark
// reads them, found anywhere in the tree.
const definitionsOf = (root: Root): ReadonlyMap<string, Definition> => {
  const definitions = new Map<string, Definition>();
  const waiting: Nodes[] = [root];

  for (let next = waiting.pop(); next !== undefined; next = waiting.pop()) {
    if (next.type === "definition" && !definitions.has(next.identifier)) {
      definitions.set(next.identifier, next);
    }

    if ("children" in next) {
      waiting.push(...next.children);
    }
  }

  return definitions;
};

interface Waiting {
  readonly depth: number;
  readonly node: RootContent;
  readonly out: BlockOut[];
  /** The text a task item's first paragraph starts with. */
  readonly prefix?: string;
}

/** What the walk of the tree holds. */
interface BlockWalk {
  blocks: number;
  /** The blocks of containers the walk made, never left empty. */
  readonly containers: BlockOut[][];
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly media: Set<string>;
  readonly problems: MarkdownProblems;
  text: number;
  readonly waiting: Waiting[];
}

type Step = (walk: BlockWalk, at: Waiting) => void;

const put = (walk: BlockWalk, out: BlockOut[], block: BlockOut) => {
  walk.blocks += 1;
  out.push(block);
};

// The nodes, in order, to walk next into `out`, the first with `prefix`.
const later = (
  walk: BlockWalk,
  nodes: readonly RootContent[],
  out: BlockOut[],
  depth: number,
  prefix?: string
) => {
  for (const [index, node] of nodes.entries().toArray().toReversed()) {
    walk.waiting.push(
      index === 0 && prefix !== undefined
        ? { depth, node, out, prefix }
        : { depth, node, out }
    );
  }
};

const textLength = (inlines: readonly InlineOut[]) =>
  inlines.reduce(
    (length, inline) =>
      length + (inline.type === "text" ? inline.text.length : 0),
    0
  );

// Breaks at the edges of a piece of a paragraph show nothing.
const trimmed = (inlines: readonly InlineOut[]): InlineOut[] => {
  let start = 0;
  let end = inlines.length;

  while (start < end && inlines[start]?.type === "hardBreak") {
    start += 1;
  }

  while (end > start && inlines[end - 1]?.type === "hardBreak") {
    end -= 1;
  }

  return inlines.slice(start, end);
};

// Spaces alone, outside code, show nothing.
const saysNothing = (inlines: readonly InlineOut[]) =>
  inlines.every(
    (inline) =>
      inline.type === "hardBreak" ||
      (inline.marks === undefined && inline.text.trim() === "")
  );

// A paragraph's pieces as paragraphs, cut around each image, which
// stands as a block of its own between them.
const paragraphsOf = (
  walk: BlockWalk,
  out: BlockOut[],
  pieces: readonly Piece[],
  prefix: string | undefined
) => {
  let line: InlineOut[] =
    prefix === undefined ? [] : [{ text: prefix, type: "text" }];

  const flush = () => {
    const inlines = trimmed(line);

    if (!saysNothing(inlines)) {
      walk.text += textLength(inlines);
      put(walk, out, { content: inlines, type: "paragraph" });
    }

    line = [];
  };

  for (const piece of pieces) {
    if (piece.type === "image") {
      flush();
      walk.text += piece.alt.length;
      walk.media.add(piece.mediaId);
      put(walk, out, {
        attrs: { alt: piece.alt, mediaId: piece.mediaId },
        type: "image",
      });
    } else {
      line.push(piece);
    }
  }

  flush();
};

const container =
  (type: "blockquote", children: readonly RootContent[]): Step =>
  (walk, at) => {
    const content: BlockOut[] = [];

    put(walk, at.out, { content, type });
    walk.containers.push(content);
    later(walk, children, content, at.depth + 1);
  };

const taskPrefix = (checked: boolean | null | undefined) => {
  if (checked === true) {
    return "[x] ";
  }

  return checked === false ? "[ ] " : undefined;
};

const listOf =
  (list: List): Step =>
  (walk, at) => {
    const items: { readonly content: BlockOut[]; readonly type: "listItem" }[] =
      [];

    const start = list.start ?? 1;

    if (list.ordered !== true) {
      put(walk, at.out, { content: items, type: "bulletList" });
    } else if (start === 1) {
      put(walk, at.out, { content: items, type: "orderedList" });
    } else {
      put(walk, at.out, {
        attrs: { start },
        content: items,
        type: "orderedList",
      });
    }

    for (const item of list.children) {
      const content: BlockOut[] = [];
      const prefix = taskPrefix(item.checked);
      const [first] = item.children;

      items.push({ content, type: "listItem" });

      if (prefix !== undefined && first?.type !== "paragraph") {
        put(walk, content, {
          content: [{ text: prefix, type: "text" }],
          type: "paragraph",
        });
      } else if (item.children.length === 0) {
        put(walk, content, { type: "paragraph" });
      }
    }

    // Walked once the items are made, so each list keeps their order.
    for (const [index, item] of list.children
      .entries()
      .toArray()
      .toReversed()) {
      const content = items[index]?.content ?? [];

      later(
        walk,
        item.children,
        content,
        at.depth + 1,
        taskPrefix(item.checked)
      );
    }
  };

const refused =
  (
    problem: "footnote" | "headingLevel" | "html" | "notTaken" | "table"
  ): Step =>
  (walk, at) => {
    walk.problems.add(problem, at.node);
  };

const nothing: Step = () => {
  // A definition shows nothing of its own: its links are read where
  // they are.
};

const stepOf: (node: RootContent) => Step = Match.type<RootContent>().pipe(
  Match.discriminators("type")({
    blockquote: ({ children }) => container("blockquote", children),
    code:
      ({ lang, value }): Step =>
      (walk, at) => {
        walk.text += value.length;

        const content: InlineOut[] =
          value === "" ? [] : [{ text: value, type: "text" }];

        // A language that is no word of code shows nothing: it is left
        // out, the code kept.
        put(
          walk,
          at.out,
          isLanguage(lang)
            ? { attrs: { language: lang }, content, type: "codeBlock" }
            : { content, type: "codeBlock" }
        );
      },
    definition: () => nothing,
    footnoteDefinition: () => refused("footnote"),
    heading: (heading): Step => {
      if (heading.depth < 2 || heading.depth > 4) {
        return refused("headingLevel");
      }

      return (walk, at) => {
        const inlines = piecesOf(heading.children, {
          definitions: walk.definitions,
          inHeading: true,
          problems: walk.problems,
        }).filter((piece): piece is InlineOut => piece.type !== "image");

        walk.text += textLength(inlines);
        put(walk, at.out, {
          attrs: { level: heading.depth },
          content: inlines,
          type: "heading",
        });
      };
    },
    html: ({ value }) => (isHtmlComment(value) ? nothing : refused("html")),
    list: listOf,
    paragraph:
      ({ children }): Step =>
      (walk, at) => {
        paragraphsOf(
          walk,
          at.out,
          piecesOf(children, {
            definitions: walk.definitions,
            inHeading: false,
            problems: walk.problems,
          }),
          at.prefix
        );
      },
    table: () => refused("table"),
    thematicBreak: (): Step => (walk, at) => {
      put(walk, at.out, { type: "horizontalRule" });
    },
  }),
  Match.orElse(() => refused("notTaken"))
);

/**
 * The tree's blocks as the document's, its problems told to `problems`:
 * past a body's bounds, `tooLarge`, at the node that went past its depth.
 */
export const blocksOf = (
  root: Root,
  problems: MarkdownProblems
): readonly BlockOut[] => {
  const blocks: BlockOut[] = [];

  const walk: BlockWalk = {
    blocks: 0,
    containers: [],
    definitions: definitionsOf(root),
    media: new Set(),
    problems,
    text: 0,
    waiting: [],
  };

  later(walk, root.children, blocks, 1);

  for (
    let next = walk.waiting.pop();
    next !== undefined;
    next = walk.waiting.pop()
  ) {
    if (walk.blocks > maxBodyNodes || walk.text > maxBodyText) {
      problems.add("tooLarge");

      break;
    }

    if (next.depth > maxBodyDepth) {
      problems.add("tooLarge", next.node);
    } else {
      stepOf(next.node)(walk, next);
    }
  }

  if (walk.media.size > maxOverrideMedia) {
    problems.add("tooLarge");
  }

  // A quote that said nothing keeps a paragraph, as the editor's do.
  for (const content of walk.containers) {
    if (content.length === 0) {
      content.push({ type: "paragraph" });
    }
  }

  return blocks;
};
