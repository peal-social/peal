import { Schema } from "effect";

/**
 * A rich text: the document of the web app's rich-text editor, in its
 * JSON (a ProseMirror document), which a website's post may have as its
 * text there (`TextOverride.body`). `content` holds its blocks, each with
 * a `type`: `paragraph` and `heading` (`attrs.level` 2, 3 or 4) of inline
 * `text` (with `marks`: `bold`, `italic`, `strike`, `code`, `link` with
 * `attrs.href` on http, https or mailto) and `hardBreak`; `bulletList` and
 * `orderedList` (`attrs.start`) of `listItem`s; `blockquote`;
 * `horizontalRule`; `codeBlock` of plain text; `image` with
 * `attrs.mediaId`, a file of the workspace's library, and `attrs.alt`.
 * Anything else is refused (PostContentInvalid `bodyInvalid`); the server
 * writes what the site gets from the document alone. The server's
 * allow-list (src/shared/domain/rich-text/rich-body.ts) is the source.
 */
export const RichTextSchema = Schema.Struct({
  content: Schema.Array(Schema.Unknown),
  type: Schema.Literal("doc"),
}).annotate({
  description:
    "The rich-text editor's document: blocks of paragraphs, headings, lists, quotes, rules, code and images.",
  identifier: "RichText",
});

export type RichText = typeof RichTextSchema.Type;
