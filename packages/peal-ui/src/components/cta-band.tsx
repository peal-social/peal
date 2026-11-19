import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import type { Cta } from "../lib/site/measurement/events";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { PixelGlow } from "./pixel-glow";

interface CtaLink {
  readonly href: string;
  readonly label: string;
  /** The call to action a click on it counts as, where the site measures. */
  readonly measure?: Cta | undefined;
}

/**
 * The closing call to action (DESIGN.md, Site): a band on the page's grid
 * with the brand's glows in pixels behind it, a centred headline and line,
 * the primary button and an outline one beside it. The glow is drawn in
 * the browser, so a page hydrates the band.
 */
const CtaBand = ({
  className,
  line,
  primary,
  render,
  secondary,
  title,
}: Omit<PartProps<"section">, "children" | "className"> & {
  readonly className?: string | undefined;
  readonly line: string;
  readonly primary?: CtaLink | undefined;
  readonly secondary?: CtaLink | undefined;
  readonly title: string;
}) =>
  renderElement(
    "section",
    {
      "aria-label": title,
      children: (
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden border-t">
          <PixelGlow />
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-24 text-center sm:py-28">
            <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[40px]">
              {title}
            </h2>
            <p className="text-muted-foreground max-w-[40rem] text-base sm:text-lg">
              {line}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {primary === undefined ? null : (
                <a
                  href={primary.href}
                  data-measure-cta={primary.measure}
                  data-measure-place={
                    primary.measure === undefined ? undefined : "closing"
                  }
                  className={buttonVariants()}
                >
                  {primary.label}
                </a>
              )}
              {secondary === undefined ? null : (
                <a
                  href={secondary.href}
                  data-measure-cta={secondary.measure}
                  data-measure-place={
                    secondary.measure === undefined ? undefined : "closing"
                  }
                  className={buttonVariants({ variant: "outline" })}
                >
                  {secondary.label}
                </a>
              )}
            </div>
          </div>
        </div>
      ),
      className: cn("", className),
      "data-slot": "cta-band",
    },
    render
  );

export { CtaBand };

export type { CtaLink };
