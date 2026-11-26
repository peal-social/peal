// The editor's document as the walk of a Markdown tree writes it, before
// `ArticleBodySchema` reads it: plain JSON, mutable while it is built.

export type MarkOut =
  | { readonly attrs: { readonly href: string }; readonly type: "link" }
  | { readonly type: "bold" | "code" | "italic" | "strike" };

export interface TextOut {
  readonly marks?: readonly MarkOut[];
  readonly text: string;
  readonly type: "text";
}

export type InlineOut = TextOut | { readonly type: "hardBreak" };

/** What a block's `attrs` may say, by the node: the allow-list's. */
export interface AttrsOut {
  readonly alt?: string;
  readonly language?: string;
  readonly level?: number;
  readonly mediaId?: string;
  readonly start?: number;
}

export interface BlockOut {
  readonly attrs?: AttrsOut;
  readonly content?: readonly (BlockOut | InlineOut)[];
  readonly type: string;
}

/** An image of the library, as an inline piece a paragraph is cut around. */
export interface ImageOut {
  readonly alt: string;
  readonly mediaId: string;
  readonly type: "image";
}

/** A piece of a paragraph's inline content. */
export type Piece = ImageOut | InlineOut;

export const textOut = (text: string, marks: readonly MarkOut[]): TextOut =>
  marks.length === 0 ? { text, type: "text" } : { marks, text, type: "text" };

/** The marks with one more, a mark of a kind they have already left out. */
export const withMark = (marks: readonly MarkOut[], mark: MarkOut) =>
  marks.some(({ type }) => type === mark.type) ? marks : [...marks, mark];
