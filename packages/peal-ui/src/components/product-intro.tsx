"use client";

import { ArrowRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { PixelField } from "./pixel-field";
import { Eyebrow, SectionCounter, SectionHeadline } from "./section-opener";
import type { SectionTitle } from "./section-opener";
import type { SiteIcon } from "./site-icons";

/**
 * A product's section opening (DESIGN.md, Site): its counter, then, over
 * the faint pixel field, the product's name as an eyebrow, the headline
 * and an outline button on the left, and a lead on the right.
 */
const ProductIntro = ({
  action,
  className,
  counter,
  eyebrow,
  headingId,
  lead,
  title,
}: {
  readonly action?:
    | { readonly href: string; readonly label: string }
    | undefined;
  readonly className?: string | undefined;
  readonly counter: string;
  readonly eyebrow: {
    readonly icon?: SiteIcon | undefined;
    readonly label: string;
  };
  /** The headline's id, for the section's `aria-labelledby`. */
  readonly headingId: string;
  readonly lead: string;
  readonly title: SectionTitle;
}) => (
  <>
    <SectionCounter counter={counter} />
    <div
      className={cn(
        "relative mx-auto max-w-6xl overflow-hidden border-t px-6 py-16 sm:px-8 sm:py-20",
        className
      )}
    >
      <PixelField />
      {/* On a phone: headline, lead, button; from 1024 px the lead moves
          to the right, level with the button. */}
      <div className="relative grid gap-6 lg:grid-cols-2 lg:gap-x-16">
        <div className="flex flex-col items-start gap-5 lg:col-start-1">
          <Eyebrow icon={eyebrow.icon} label={eyebrow.label} />
          <SectionHeadline id={headingId} title={title} />
        </div>
        <p className="text-muted-foreground max-w-[40rem] self-end text-base sm:text-lg lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {lead}
        </p>
        {action === undefined ? null : (
          <a
            href={action.href}
            className="bg-card text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex h-[34px] w-fit items-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-none focus-visible:ring-3 lg:col-start-1"
          >
            {action.label}
            <ArrowRightIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4"
            />
          </a>
        )}
      </div>
    </div>
  </>
);

export { ProductIntro };
