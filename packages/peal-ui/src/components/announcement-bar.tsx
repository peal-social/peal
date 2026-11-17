import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { ArrowRightIcon } from "lucide-react";

import { cn } from "../lib/utils";

interface AnnouncementLink {
  readonly href: string;
  readonly label: string;
}

/**
 * A line the whole site needs to say, such as where Peal stands (DESIGN.md,
 * Site): a thin ink bar above the header, across the page, a yellow pixel,
 * the text, and a link to read more. Nothing to dismiss: it stays while it
 * is true, and the site drops it when it is not.
 */
const AnnouncementBar = ({
  className,
  link,
  render,
  text,
  ...props
}: Omit<PartProps<"div">, "children" | "className"> & {
  readonly className?: string | undefined;
  readonly link?: AnnouncementLink | undefined;
  readonly text: string;
}) =>
  renderElement(
    "div",
    {
      ...props,
      children: (
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] sm:px-6">
          <span>
            <span
              aria-hidden="true"
              className="bg-sun me-2 mb-px inline-block size-[5px] align-middle"
            />
            {text}
          </span>
          {link === undefined ? null : (
            <a
              href={link.href}
              className="group/announcement focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            >
              {link.label}
              <ArrowRightIcon
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-3.5 transition-transform group-hover/announcement:translate-x-0.5 motion-reduce:transition-none"
              />
            </a>
          )}
        </p>
      ),
      className: cn("bg-foreground text-background relative", className),
      "data-slot": "announcement-bar",
      role: "region",
      "aria-label": text,
    },
    render
  );

export { AnnouncementBar };

export type { AnnouncementLink };
