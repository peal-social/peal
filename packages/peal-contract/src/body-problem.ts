import { Schema } from "effect";

/** The most problems a refused body sent as Markdown is answered with. */
export const maxBodyProblems = 20;

/**
 * Why Peal does not take a body sent as Markdown (`bodyMarkdown`), by
 * construct: `headingLevel`, a heading of level 1, 5 or 6 (headings go
 * from `##` to `####`; the title is the channel's `title` option);
 * `html`, raw HTML but a comment or `<br>`; `table`; `footnote`;
 * `frontMatter`, a block of `---` lines at the top (the title and the
 * tags go in the channel's options); `image`, an image that is no file of
 * the library (`media:<mediaId>`), or one inside a heading or a link
 * (import a file at an address first, with media.importFromUrl); `link`,
 * a link on another scheme than http, https or mailto, or a relative one;
 * `tooLarge`, past a body's bounds (200,000 characters of text, 20,000
 * blocks, 8 levels deep, 100 files); `notTaken`, anything else a rich
 * text does not hold.
 */
export const BodyProblemKindSchema = Schema.Literals([
  "headingLevel",
  "html",
  "table",
  "footnote",
  "frontMatter",
  "image",
  "link",
  "tooLarge",
  "notTaken",
]).annotate({ identifier: "BodyProblemKind" });

export type BodyProblemKind = typeof BodyProblemKindSchema.Type;

const PlaceSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/**
 * One problem of a body sent as Markdown: its kind, and where it starts in
 * the Markdown sent, by line and column from 1, when it has a place. It
 * never quotes the Markdown.
 */
export const BodyProblemSchema = Schema.Struct({
  column: Schema.optionalKey(PlaceSchema),
  line: Schema.optionalKey(PlaceSchema),
  problem: BodyProblemKindSchema,
}).annotate({ identifier: "BodyProblem" });

export type BodyProblem = typeof BodyProblemSchema.Type;
