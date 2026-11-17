"use client";

import type * as React from "react";

import { cn } from "../lib/utils";
import { PixelField } from "./pixel-field";
import { SiteIconView } from "./site-icons";
import type { SiteIcon } from "./site-icons";

// The brackets around an eyebrow's label, as text.
const slashes = "//";
const backslashes = String.raw`\\`;

interface SectionTitle {
  /** The second sentence, in muted text. */
  readonly muted?: string | undefined;
  readonly text: string;
}

/** A small label with an icon between slashes: `// [icon] Label \\`. */
const Eyebrow = ({
  className,
  icon,
  label,
}: {
  readonly className?: string | undefined;
  readonly icon?: SiteIcon | undefined;
  readonly label: string;
}) => (
  <p
    className={cn(
      "text-muted-foreground inline-flex items-center gap-1.5 font-mono text-xs tracking-[0.04em]",
      className
    )}
  >
    <span aria-hidden="true">{slashes}</span>
    {icon === undefined ? null : (
      <SiteIconView icon={icon} className="text-foreground size-3.5" />
    )}
    <span>{label}</span>
    <span aria-hidden="true">{backslashes}</span>
  </p>
);

/** A section headline: a sentence, then a second one in muted text. */
const SectionHeadline = ({
  className,
  id,
  title,
}: {
  readonly className?: string | undefined;
  readonly id?: string | undefined;
  readonly title: SectionTitle;
}) => (
  <h2
    id={id}
    className={cn(
      "text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[40px]",
      className
    )}
  >
    {title.text}
    {title.muted === undefined ? null : (
      <>
        {" "}
        <span className="text-muted-foreground">{title.muted}</span>
      </>
    )}
  </h2>
);

/** The section's counter, such as `[ 02 / 08 ] · Try it`, over a rule. */
const SectionCounter = ({ counter }: { readonly counter: string }) => (
  <p className="text-muted-foreground mx-auto max-w-6xl px-6 pt-16 pb-4 font-mono text-xs tracking-[0.04em]">
    {counter}
  </p>
);

/**
 * A section's opening (DESIGN.md, Site): its counter, then a centred
 * eyebrow, headline and lead over a faint pixel field.
 */
const SectionOpener = ({
  children,
  counter,
  eyebrow,
  headingId,
  lead,
  title,
}: {
  readonly children?: React.ReactNode;
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
    <div className="relative mx-auto max-w-6xl overflow-hidden border-t px-6 py-16 text-center sm:py-20">
      <PixelField />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5">
        <Eyebrow icon={eyebrow.icon} label={eyebrow.label} />
        <SectionHeadline id={headingId} title={title} />
        <p className="text-muted-foreground max-w-[40rem] text-base sm:text-lg">
          {lead}
        </p>
        {children}
      </div>
    </div>
  </>
);

export { Eyebrow, SectionCounter, SectionHeadline, SectionOpener };

export type { SectionTitle };
