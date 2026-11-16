import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { cn } from "../../lib/utils";

/** What a section label says: its word, and its place on the page. */
interface SectionLabelContent {
  /** The section's number, from 1, shown as two digits. */
  readonly index?: number | undefined;
  /** How many sections the page numbers, shown after the index. */
  readonly of?: number | undefined;
  readonly text: string;
}

type SectionLabelProps = Omit<PartProps<"p">, "children" | "className"> &
  SectionLabelContent & {
    readonly className?: string | undefined;
  };

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * A section's label above its headline (DESIGN.md, The site's headlines):
 * the caption role in square brackets, `[ features ]`, or with its place,
 * `[ 02 / 06 · features ]`. Never a link.
 */
const SectionLabel = ({
  className,
  index,
  of,
  render,
  text,
  ...props
}: SectionLabelProps) =>
  renderElement(
    "p",
    {
      ...props,
      children: (
        <>
          <span aria-hidden="true">[ </span>
          {index === undefined ? null : (
            <span className="tabular-nums">
              {twoDigits(index)}
              {of === undefined ? null : ` / ${twoDigits(of)}`}
              {" · "}
            </span>
          )}
          {text}
          <span aria-hidden="true"> ]</span>
        </>
      ),
      className: cn(
        "text-muted-foreground font-mono text-xs tracking-[0.04em] lowercase",
        className
      ),
      "data-slot": "section-label",
    },
    render
  );

export { SectionLabel };

export type { SectionLabelContent, SectionLabelProps };
