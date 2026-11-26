import { Schema } from "effect";

/** The most characters a body sent as Markdown holds. */
export const maxBodyMarkdownLength = 400_000;

/** The most problems a refused body is answered with. */
export const maxBodyProblems = 20;

/**
 * Why a body sent as Markdown is refused, construct by construct, never
 * dropped and never published as stray characters: a heading of level 1,
 * 5 or 6 (`headingLevel`: the title is the channel's `title` option); raw
 * HTML other than a comment or `<br>` (`html`); a table (`table`); a
 * footnote (`footnote`); a front matter block (`frontMatter`: the title
 * and the tags are options); an image that is no file of the library
 * (`media:<id>`), or one inside a heading or a link (`image`); a link on
 * another scheme than http, https or mailto, or a relative one (`link`);
 * more than a body's bounds (`tooLarge`); anything else the allow-list
 * does not take (`notTaken`).
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
]);

export type BodyProblemKind = typeof BodyProblemKindSchema.Type;

const PlaceSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/**
 * One problem of a body sent as Markdown: its kind, and where it starts
 * in the Markdown sent (its line and column, from 1) when it has a place.
 * Never an excerpt: a problem holds no content.
 */
export const BodyProblemSchema = Schema.Struct({
  column: Schema.optionalKey(PlaceSchema),
  line: Schema.optionalKey(PlaceSchema),
  problem: BodyProblemKindSchema,
});

export type BodyProblem = typeof BodyProblemSchema.Type;
