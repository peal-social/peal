import { Context } from "effect";
import type { Array as Arr, Result } from "effect";

import type { BodyProblem } from "#publishing/domain/body-problem.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

/** How a body sent as Markdown is read. */
export interface MarkdownReader {
  /**
   * The Markdown as the editor's document, on the allow-list and within a
   * body's bounds (`ArticleBodySchema`), or why not: up to
   * `maxBodyProblems` problems, each with its place in the Markdown. What
   * is not on the allow-list is refused, never dropped.
   */
  readonly read: (
    markdown: string
  ) => Result.Result<ArticleBody, Arr.NonEmptyReadonlyArray<BodyProblem>>;
}

/**
 * Reads a website's body sent as Markdown (`bodyMarkdown`) into the one
 * form Peal keeps, the allow-listed document, where requests are read: the
 * Markdown itself is never stored or answered.
 */
export class MarkdownBodies extends Context.Service<
  MarkdownBodies,
  MarkdownReader
>()("peal-server/publishing/application/MarkdownBodies") {}
