import { Fragment } from "react";

import "../lib/css-properties";
import { decodeHighlighted } from "../lib/highlighted-code";
import type { CodeTokenKind } from "../lib/highlighted-code";

// A code block's lines, rendered once on the server as static HTML. The
// page hands them to CodeBlock's island in its slots, so the code crosses
// to the browser once, as markup, and never as props or as a React tree:
// switching the language only shows another panel.

const kindClass: Record<CodeTokenKind, string> = {
  comment: "text-code-comment",
  constant: "text-code-constant",
  deleted: "text-code-deleted",
  keyword: "text-code-keyword",
  punctuation: "text-code-punctuation",
  string: "text-code-string",
  type: "text-code-type",
};

interface CodeLinesProps {
  /** The code, as `encodeHighlighted` (peal-ui's lib/highlighted-code) writes it. */
  readonly highlighted: string;
  /** Numbers each line, in a column that stays put as the code scrolls. */
  readonly lineNumbers?: boolean | undefined;
  /**
   * The lines it is as tall as, at least, from 48 rem of block width, so
   * switching keeps its height; narrower, each language takes its own.
   */
  readonly minLines?: number | undefined;
}

/**
 * The lines on `muted`, in Geist Mono: a long line never wraps, so the
 * code keeps the shape it is copied in and the numbers stay level with
 * their lines. CodeBlock scrolls them sideways.
 */
const CodeLines = ({
  highlighted,
  lineNumbers = false,
  minLines,
}: CodeLinesProps) => (
  <pre
    style={{ "--code-lines": String(minLines ?? 0) }}
    className="text-code-foreground py-4 font-mono text-[13px] leading-relaxed @min-[48rem]:min-h-[calc(var(--code-lines)*1lh+2rem)]"
  >
    <code className="block w-max min-w-full">
      {decodeHighlighted(highlighted).map((runs, index) => {
        const number = index + 1;

        return (
          <span key={number} className="flex pe-4">
            {lineNumbers ? (
              <span
                aria-hidden="true"
                className="bg-code-background text-code-comment sticky start-0 w-[5ch] shrink-0 ps-[1ch] pe-[1.5ch] text-end select-none"
              >
                {number}
              </span>
            ) : (
              <span aria-hidden="true" className="w-4 shrink-0" />
            )}
            <span data-code-line="" className="whitespace-pre">
              {/* Plain text takes no element of its own: the home page
                  holds hundreds of such runs. */}
              {runs.map((run) =>
                run.kind === undefined ? (
                  <Fragment key={run.offset}>{run.text}</Fragment>
                ) : (
                  <span key={run.offset} className={kindClass[run.kind]}>
                    {run.text}
                  </span>
                )
              )}
              {"\n"}
            </span>
          </span>
        );
      })}
    </code>
  </pre>
);

/** The plain source of the lines under `root`, as Copy copies it. */
const codeLinesSource = (root: ParentNode): string =>
  Array.from(
    // Each line's text carries `data-code-line`, its number does not.
    root.querySelectorAll("[data-code-line]"),
    (line) => line.textContent.replace(/\n$/u, "")
  ).join("\n");

export { CodeLines, codeLinesSource };

export type { CodeLinesProps };
