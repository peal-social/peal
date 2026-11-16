// The showcase's content: synthetic, for layout only, and plainly so. No
// public page imports this file (test/showcase.test.ts): a block reaches a
// public page with real copy from messages.ts, or real data from the
// contract, never with these.
import type { SiteMark } from "peal-ui/blocks/blueprint/mark";

/** Said under every specimen, so no screenshot passes for a real page. */
export const syntheticNote = "Synthetic content, for layout only.";

/** A made-up brand's mark: a rounded square, standing for any logo. */
export const exampleMark: SiteMark = {
  kind: "path",
  path: "M6 2h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm2 6v8h8V8z",
};

/** A made-up brand with no mark, as a lettered tile. */
export const exampleLetters: SiteMark = { kind: "letters", letters: "Ex" };

export const exampleCompany = "Example Company";

/** Copy at the length the site writes, in English. */
export const short = {
  body: "Every block takes its words as props, so a page writes them once in its own language.",
  label: "features",
  lead: "A synthetic lead under the headline, one or two lines long, for layout only.",
  statementBody:
    "and continues in muted text, as long as the paragraph needs, for layout only.",
  statementLead: "A synthetic statement leads in ink",
  title: "A synthetic headline.",
  titleMuted: "Its second sentence is muted.",
};

/** The longest copy a block should hold, to find where it breaks. */
export const long = {
  lead: "A synthetic lead that runs much longer than any the site would write, to show how the block wraps a lead that goes on past two lines, and where its measure stops it, at forty rem.",
  title:
    "A synthetic headline long enough to wrap over three lines on a phone and two on a desktop.",
  titleMuted:
    "Its muted second sentence is long as well, to see both wrap together.",
};

/** Copy as long as French makes it, about a quarter longer than English. */
export const frenchLength = {
  lead: "Une accroche synthétique sous le titre, plus longue d’un quart que l’anglaise, pour la mise en page seulement.",
  title: "Un titre synthétique, plus long en français.",
  titleMuted: "Sa seconde phrase est en gris, elle aussi.",
};
