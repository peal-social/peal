import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { cn } from "../../lib/utils";
import { SectionLabel } from "./section-label";
import type { SectionLabelContent } from "./section-label";

/** A section's opening, as the blocks with a title take it. */
interface SectionHeadingContent {
  readonly label?: SectionLabelContent | undefined;
  /** A line or two under the headline. */
  readonly lead?: string | undefined;
  /** The heading's level in the page's outline; 2 by default. */
  readonly level?: 2 | 3 | undefined;
  readonly title: string;
  /** A second sentence, in muted text, after the title. */
  readonly titleMuted?: string | undefined;
}

type SectionHeadingProps = Omit<PartProps<"div">, "children" | "className"> & {
  readonly className?: string | undefined;
  readonly heading: SectionHeadingContent;
  /** The heading's own id, for the section's `labelledBy`. */
  readonly headingId?: string | undefined;
};

/**
 * A site section's label, headline and lead (DESIGN.md, The site's
 * headlines): the headline at 40 px (30 on a phone), its second sentence
 * muted, the lead at 18 px (16), at most 40 rem wide.
 */
const SectionHeading = ({
  className,
  heading,
  headingId,
  render,
  ...props
}: SectionHeadingProps) => {
  const Heading = heading.level === 3 ? "h3" : "h2";

  return renderElement(
    "div",
    {
      ...props,
      children: (
        <>
          {heading.label === undefined ? null : (
            <SectionLabel {...heading.label} className="mb-4" />
          )}
          <Heading
            id={headingId}
            className="max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[40px]"
          >
            {heading.title}
            {heading.titleMuted === undefined ? null : (
              <>
                {" "}
                <span className="text-muted-foreground">
                  {heading.titleMuted}
                </span>
              </>
            )}
          </Heading>
          {heading.lead === undefined ? null : (
            <p className="text-muted-foreground mt-4 max-w-[40rem] text-base sm:text-lg">
              {heading.lead}
            </p>
          )}
        </>
      ),
      className: cn("px-6 py-12 sm:py-16", className),
      "data-slot": "section-heading",
    },
    render
  );
};

export { SectionHeading };

export type { SectionHeadingContent, SectionHeadingProps };
