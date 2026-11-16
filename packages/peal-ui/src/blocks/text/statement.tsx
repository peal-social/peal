import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { cn } from "../../lib/utils";

type StatementProps = Omit<PartProps<"p">, "children" | "className"> & {
  /** What the paragraph continues with, in muted text. */
  readonly body: string;
  readonly className?: string | undefined;
  /** The phrase it leads with, in ink. */
  readonly lead: string;
};

/**
 * A paragraph that leads with a phrase in ink and continues in muted text,
 * at the lead's size (DESIGN.md, The site's headlines).
 */
const Statement = ({
  body,
  className,
  lead,
  render,
  ...props
}: StatementProps) =>
  renderElement(
    "p",
    {
      ...props,
      children: (
        <>
          <strong className="text-foreground font-semibold">{lead}</strong>{" "}
          <span className="text-muted-foreground">{body}</span>
        </>
      ),
      className: cn("max-w-[40rem] text-base sm:text-lg", className),
      "data-slot": "statement",
    },
    render
  );

export { Statement };

export type { StatementProps };
