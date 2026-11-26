import { Array as Arr, Layer, Option, Result, Schema } from "effect";
import type { Nodes, Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Extension, Transform } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

import { MarkdownBodies } from "#publishing/application/markdown-bodies.ts";
import { maxBodyMarkdownLength } from "#publishing/domain/body-problem.ts";
import type { BodyProblem } from "#publishing/domain/body-problem.ts";
import {
  ArticleBodySchema,
  maxBodyDepth,
} from "#shared/domain/rich-text/rich-body.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

import { blocksOf } from "./markdown-blocks.ts";
import { MarkdownProblems } from "./markdown-problems.ts";

// A website's body sent as Markdown, read into the editor's document.
//
// The dialect is CommonMark with GitHub's extensions, parsed into a syntax
// tree (mdast) by `mdast-util-from-markdown`, whose compiler builds the
// tree from micromark's events with a stack, never by recursion. GitHub's
// tree transforms (the bare addresses it links) visit the tree
// recursively, and would exhaust the stack on a tree thousands deep: they
// run only once the tree is measured, without recursion, to nest no
// deeper than `maxTreeDepth`; a deeper one is `tooLarge`. The tree is then
// walked, with stacks of its own (`markdown-blocks.ts`,
// `markdown-inline.ts`), into the document's blocks and inline text,
// construct by construct: what the allow-list has a node or a mark for
// becomes it, and everything else is a problem with its place in the
// Markdown, never dropped and never written as stray characters. No HTML
// is ever written from the tree, so there is nothing to sanitise; the
// document the walk made is then decoded with `ArticleBodySchema`, so the
// allow-list stays the one gate (what the walk let through and the schema
// refuses is `notTaken`).

const decodeBody = Schema.decodeUnknownOption(ArticleBodySchema);

// GitHub's extensions to the tree, its transforms apart.
const gfmExtensions: readonly Extension[] = gfmFromMarkdown();

const gfmHandlers: Extension[] = gfmExtensions.map(
  ({ transforms: _transforms, ...handlers }) => handlers
);

const gfmTransforms: readonly Transform[] = gfmExtensions.flatMap(
  ({ transforms }) => transforms ?? []
);

/**
 * How deep a tree may nest before GitHub's transforms visit it: a body's
 * blocks nest `maxBodyDepth` deep, a list's item adding a level of the
 * tree to each, with inline marks inside; anything deeper is no body.
 */
const maxTreeDepth = 4 * maxBodyDepth;

// The first node found past `maxTreeDepth`, measured without recursion.
const tooDeep = (root: Root): Option.Option<Nodes> => {
  const waiting: { readonly depth: number; readonly node: Nodes }[] = [
    { depth: 0, node: root },
  ];

  for (let next = waiting.pop(); next !== undefined; next = waiting.pop()) {
    if (next.depth > maxTreeDepth) {
      return Option.some(next.node);
    }

    if ("children" in next.node) {
      for (const child of next.node.children) {
        waiting.push({ depth: next.depth + 1, node: child });
      }
    }
  }

  return Option.none();
};

// Front matter: `---` alone on the first line, closed by `---` alone on a
// later one, with something on the line after the first. It is seen before
// the Markdown is parsed, which would read it as a rule and a heading.
const fenceLine = /^---[ \t]*$/u;

const hasFrontMatter = (markdown: string) => {
  const [first, second, ...rest] = markdown.split(/\r\n|\r|\n/u);

  return (
    first !== undefined &&
    fenceLine.test(first) &&
    second !== undefined &&
    second.trim() !== "" &&
    !fenceLine.test(second) &&
    rest.some((line) => fenceLine.test(line))
  );
};

type Read = Result.Result<ArticleBody, Arr.NonEmptyReadonlyArray<BodyProblem>>;

const refused = (problem: BodyProblem): Read => Result.fail([problem]);

/** The Markdown as the document, or its problems. */
export const readMarkdown = (markdown: string): Read => {
  if (markdown.length > maxBodyMarkdownLength) {
    return refused({ problem: "tooLarge" });
  }

  if (hasFrontMatter(markdown)) {
    return refused({ column: 1, line: 1, problem: "frontMatter" });
  }

  const parsed = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: gfmHandlers,
  });

  const deepest = Option.flatMap(tooDeep(parsed), (node) =>
    Option.fromNullishOr(node.position?.start)
  );

  if (Option.isSome(deepest)) {
    const { column, line } = deepest.value;

    return refused({ column, line, problem: "tooLarge" });
  }

  let root = parsed;

  for (const transform of gfmTransforms) {
    root = transform(root) ?? root;
  }

  const problems = new MarkdownProblems();
  const content = blocksOf(root, problems);

  if (Arr.isReadonlyArrayNonEmpty(problems.found)) {
    return Result.fail(problems.found);
  }

  return Option.match(decodeBody({ content, type: "doc" }), {
    onNone: () => refused({ problem: "notTaken" }),
    onSome: (body) => Result.succeed(body),
  });
};

/** Bodies sent as Markdown, read by the syntax tree's parser. */
export const MdastMarkdownBodies = Layer.succeed(
  MarkdownBodies,
  MarkdownBodies.of({ read: readMarkdown })
);
