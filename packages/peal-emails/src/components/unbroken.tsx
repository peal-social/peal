import type { ReactNode } from "react";

const hyphenated = /(?<word>e-mails?)/iu;

/**
 * Words as an email shows them, each "e-mail" kept on one line, as a line
 * may otherwise end at its hyphen. The words themselves stay as they are,
 * for a screen reader, a search or a copy.
 */
export const unbroken = (words: string): ReactNode =>
  // What the expression captures is every second part.
  words.split(hyphenated).map((part, position) =>
    position % 2 === 0 ? (
      part
    ) : (
      <span key={`${position}`} style={{ whiteSpace: "nowrap" }}>
        {part}
      </span>
    )
  );
