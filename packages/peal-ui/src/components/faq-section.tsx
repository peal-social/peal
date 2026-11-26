"use client";

import { MessageCircleQuestionMarkIcon } from "lucide-react";
import { useId } from "react";

import { cn } from "../lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "./accordion";
import { PixelIconArt } from "./pixel-icon-art";
import { SectionCounter } from "./section-opener";

// The label's brackets, as text.
const slashes = "//";
const backslashes = String.raw`\\`;

interface FaqQuestion {
  readonly answer: string;
  readonly question: string;
}

interface FaqGroup {
  readonly questions: readonly FaqQuestion[];
  readonly title: string;
}

interface FaqSectionProps {
  readonly className?: string | undefined;
  /** The section's counter, such as `[ 03 / 03 ] · FAQ`. */
  readonly counter?: string | undefined;
  readonly groups: readonly FaqGroup[];
  /** The short label over the art, such as `FAQ`. */
  readonly label: string;
  readonly lead?: string | undefined;
  /** The headline: a sentence, then, if any, a second one in muted text. */
  readonly title: {
    readonly muted?: string | undefined;
    readonly text: string;
  };
}

/**
 * A FAQ on the site's blueprint (DESIGN.md, Site): a band with flowing
 * pixel art and its label over it on the left and the headline on the
 * right, then a row per group, its title on the left and its questions as
 * an accordion on the right. Several answers may be open at once, and
 * closed ones stay in the page, findable with the browser's search.
 */
const FaqSection = ({
  className,
  counter,
  groups,
  label,
  lead,
  title,
}: FaqSectionProps) => {
  const heading = useId();

  return (
    <section
      aria-labelledby={heading}
      data-slot="faq-section"
      className={cn("mx-auto max-w-6xl", className)}
    >
      {counter === undefined ? null : <SectionCounter counter={counter} />}
      <div className="grid border-y md:grid-cols-2">
        <div className="relative flex h-40 items-center justify-center overflow-hidden border-b md:h-auto md:min-h-64 md:border-e md:border-b-0">
          <PixelIconArt
            art={<MessageCircleQuestionMarkIcon strokeWidth={2} />}
            cells={34}
          />
          <span className="bg-background text-muted-foreground relative flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-xs tracking-[0.04em]">
            <span aria-hidden="true">{slashes}</span>
            <MessageCircleQuestionMarkIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-3.5"
            />
            <span>{label}</span>
            <span aria-hidden="true">{backslashes}</span>
          </span>
        </div>
        <div className="flex flex-col justify-center gap-5 px-6 py-16 sm:py-20">
          <h2
            id={heading}
            className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[40px]"
          >
            {title.text}
            {title.muted === undefined ? null : (
              <>
                {" "}
                <span className="text-muted-foreground">{title.muted}</span>
              </>
            )}
          </h2>
          {lead === undefined ? null : (
            <p className="text-muted-foreground max-w-[40rem] text-base sm:text-lg">
              {lead}
            </p>
          )}
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.title} className="grid border-b md:grid-cols-2">
          <h3 className="px-6 pt-6 text-[15px] font-semibold md:border-e md:py-6">
            {group.title}
          </h3>
          <Accordion multiple hiddenUntilFound>
            {group.questions.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger level={4}>{item.question}</AccordionTrigger>
                <AccordionPanel>{item.answer}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </section>
  );
};

export { FaqSection };

export type { FaqGroup, FaqQuestion, FaqSectionProps };
