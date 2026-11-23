// A legal document's Markdown renders flat: a heading, its paragraphs, the
// next heading. The page lays each `##` section out as its legal text
// beside its plain-language lines, so this cuts the rendered HTML at each
// <h2 and sets a section's closing <aside> apart from its text
// (src/styles/legal.css styles the result).

export interface LegalSection {
  /** The section's closing plain-language lines, an <aside>, if it has one. */
  readonly aside: string | undefined;
  /**
   * `opening`: the summary a document with plain-language lines starts
   * with, which takes no number. `paired`: text and lines side by side.
   * `stacked`: the text holds a table, which needs the page's width.
   * `plain`: no lines.
   */
  readonly kind: "opening" | "paired" | "plain" | "stacked";
  /** The heading and the legal text. */
  readonly text: string;
}

export interface LegalLayout {
  /** What comes before the first section, such as the effective date. */
  readonly preamble: string;
  readonly sections: readonly LegalSection[];
}

const asideOpen = "<aside>";
const asideClose = "</aside>";

const sectionOf = (html: string): Omit<LegalSection, "kind"> => {
  const chunk = html.trim();
  const start = chunk.lastIndexOf(asideOpen);

  return chunk.endsWith(asideClose) && start !== -1
    ? { aside: chunk.slice(start), text: chunk.slice(0, start).trim() }
    : { aside: undefined, text: chunk };
};

const kindOf = (
  { aside, text }: Omit<LegalSection, "kind">,
  opening: boolean
): LegalSection["kind"] => {
  if (aside === undefined) {
    return opening ? "opening" : "plain";
  }

  return text.includes("<table") ? "stacked" : "paired";
};

/** A rendered legal document, cut into its `##` sections. */
export const legalLayout = (html: string): LegalLayout => {
  const pieces = html.split(/(?=<h2[\s>])/u);
  // A document that opens on a heading has no preamble.
  const chunks = pieces.filter((piece) => piece.startsWith("<h2"));
  const preamble = pieces.length === chunks.length ? "" : (pieces[0] ?? "");
  const parts = chunks.map((chunk) => sectionOf(chunk));
  const summarised = parts.some(({ aside }) => aside !== undefined);

  return {
    preamble,
    sections: parts.map((part, index) => ({
      ...part,
      kind: kindOf(part, summarised && index === 0),
    })),
  };
};
