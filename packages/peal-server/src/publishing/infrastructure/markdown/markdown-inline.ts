import { Match, Option, Schema } from "effect";
import type { Definition, PhrasingContent } from "mdast";

import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import { maxLinkLength } from "#shared/domain/rich-text/rich-body.ts";

import { textOut, withMark } from "./markdown-document.ts";
import type { MarkOut, Piece } from "./markdown-document.ts";
import type { MarkdownProblems } from "./markdown-problems.ts";

// A paragraph's or a heading's inline content, flattened into text with
// its marks (outermost first, each kind once), hard breaks and images,
// walked with a stack, never by recursion. A soft line break is a space.

const isMediaId = Schema.is(MediaAssetIdSchema);

// Schemes a link may lead to, as the allow-list's: a page, or an address
// to write to; never a script or a document of its own.
const linkSchemes: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
]);

const isLinkAddress = (href: string) => {
  const url = URL.parse(href);

  return (
    href.length <= maxLinkLength &&
    url !== null &&
    linkSchemes.has(url.protocol)
  );
};

const mediaPrefix = "media:";

// The library's file an image's address names, as `media:<id>`.
const mediaIdOf = (url: string): Option.Option<string> => {
  const id = url.slice(mediaPrefix.length);

  return url.startsWith(mediaPrefix) && isMediaId(id)
    ? Option.some(id)
    : Option.none();
};

/** An HTML comment, which nothing shows. */
export const isHtmlComment = (html: string) =>
  /^<!--[\s\S]*-->$/u.test(html.trim());

const isBreakHtml = (html: string) => /^<br\s*\/?>$/iu.test(html.trim());

const lineEndings = /\r\n|\r|\n/gu;

interface Waiting {
  /** Inside a link, where no image goes. */
  readonly inLink: boolean;
  readonly marks: readonly MarkOut[];
  readonly node: PhrasingContent;
}

/** What the walk of one block's inline content holds. */
interface InlineWalk {
  readonly definitions: ReadonlyMap<string, Definition>;
  /** In a heading, where no image goes. */
  readonly inHeading: boolean;
  readonly pieces: Piece[];
  readonly problems: MarkdownProblems;
  readonly waiting: Waiting[];
}

type Step = (walk: InlineWalk, at: Waiting) => void;

// The nodes, in order, to walk next with these marks.
const within = (
  walk: InlineWalk,
  nodes: readonly PhrasingContent[],
  marks: readonly MarkOut[],
  inLink: boolean
) => {
  for (const node of nodes.toReversed()) {
    walk.waiting.push({ inLink, marks, node });
  }
};

const marked =
  (mark: MarkOut, nodes: readonly PhrasingContent[]): Step =>
  (walk, at) => {
    within(walk, nodes, withMark(at.marks, mark), at.inLink);
  };

const linked =
  (url: string, nodes: readonly PhrasingContent[]): Step =>
  (walk, at) => {
    if (!isLinkAddress(url)) {
      walk.problems.add("link", at.node);
    }

    within(
      walk,
      nodes,
      withMark(at.marks, { attrs: { href: url }, type: "link" }),
      true
    );
  };

const imaged =
  (url: string, alt: string): Step =>
  (walk, at) => {
    const mediaId = mediaIdOf(url);

    if (walk.inHeading || at.inLink || Option.isNone(mediaId)) {
      walk.problems.add("image", at.node);

      return;
    }

    walk.pieces.push({ alt, mediaId: mediaId.value, type: "image" });
  };

const refused =
  (problem: "footnote" | "html" | "image" | "link" | "notTaken"): Step =>
  (walk, at) => {
    walk.problems.add(problem, at.node);
  };

const stepOf: (node: PhrasingContent) => Step =
  Match.type<PhrasingContent>().pipe(
    Match.discriminators("type")({
      break: (): Step => (walk) => {
        walk.pieces.push({ type: "hardBreak" });
      },
      delete: ({ children }) => marked({ type: "strike" }, children),
      emphasis: ({ children }) => marked({ type: "italic" }, children),
      footnoteReference: () => refused("footnote"),
      html:
        ({ value }): Step =>
        (walk, at) => {
          if (isBreakHtml(value)) {
            walk.pieces.push({ type: "hardBreak" });
          } else if (!isHtmlComment(value)) {
            walk.problems.add("html", at.node);
          }
        },
      image: ({ alt, url }) => imaged(url, alt ?? ""),
      imageReference:
        ({ alt, identifier }): Step =>
        (walk, at) => {
          const definition = walk.definitions.get(identifier);

          (definition === undefined
            ? refused("image")
            : imaged(definition.url, alt ?? ""))(walk, at);
        },
      inlineCode:
        ({ value }): Step =>
        (walk, at) => {
          walk.pieces.push(
            textOut(value, withMark(at.marks, { type: "code" }))
          );
        },
      link: ({ children, url }) => linked(url, children),
      linkReference:
        ({ children, identifier }): Step =>
        (walk, at) => {
          const definition = walk.definitions.get(identifier);

          (definition === undefined
            ? refused("link")
            : linked(definition.url, children))(walk, at);
        },
      strong: ({ children }) => marked({ type: "bold" }, children),
      text:
        ({ value }): Step =>
        (walk, at) => {
          const text = value.replaceAll(lineEndings, " ");

          if (text !== "") {
            walk.pieces.push(textOut(text, at.marks));
          }
        },
    }),
    Match.orElse(() => refused("notTaken"))
  );

/**
 * The inline content as pieces: text with its marks, hard breaks, and the
 * library's images (`media:<id>`), an image anywhere else, or in a heading
 * or a link, a problem; a link on another scheme, raw HTML but a comment
 * or `<br>`, and a footnote too.
 */
export const piecesOf = (
  children: readonly PhrasingContent[],
  context: {
    readonly definitions: ReadonlyMap<string, Definition>;
    readonly inHeading: boolean;
    readonly problems: MarkdownProblems;
  }
): readonly Piece[] => {
  const walk: InlineWalk = { ...context, pieces: [], waiting: [] };

  within(walk, children, [], false);

  for (
    let next = walk.waiting.pop();
    next !== undefined;
    next = walk.waiting.pop()
  ) {
    stepOf(next.node)(walk, next);
  }

  return walk.pieces;
};
