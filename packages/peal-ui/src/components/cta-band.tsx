import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { cn } from "../lib/utils";
import { BrandField } from "./brand-field";

interface CtaLink {
  readonly href: string;
  readonly label: string;
}

/**
 * The closing call to action (DESIGN.md, Brand field): a band on the brand
 * field, its rails on the page's, with a white headline and line, a white
 * button with ink text, and a white text link beside it.
 */
const CtaBand = ({
  captions,
  className,
  line,
  primary,
  render,
  secondary,
  title,
}: Omit<PartProps<"section">, "children" | "className"> & {
  readonly captions?:
    | { readonly end?: string | undefined; readonly start?: string | undefined }
    | undefined;
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
        <BrandField
          captions={captions}
          railsClassName="inset-x-[max(0px,calc((100%-72rem)/2))] top-8 bottom-12"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-24 text-center sm:py-28">
            <h2 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[40px]">
              {title}
            </h2>
            <p className="max-w-[40rem] text-base sm:text-lg">{line}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {primary === undefined ? null : (
                <a
                  href={primary.href}
                  className="bg-card text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3"
                >
                  {primary.label}
                </a>
              )}
              {secondary === undefined ? null : (
                <a
                  href={secondary.href}
                  className="focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
                >
                  {secondary.label}
                </a>
              )}
            </div>
          </div>
        </BrandField>
      ),
      className: cn("", className),
      "data-slot": "cta-band",
    },
    render
  );

export { CtaBand };

export type { CtaLink };
