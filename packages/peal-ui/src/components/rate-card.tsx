"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@ui-sdk/react/accordion";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { PixelField } from "./pixel-field";
import { Eyebrow, SectionHeadline } from "./section-opener";
import { Mark, markKey, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

/** A plan's column: its name, a line under it, and its way in. */
interface RateCardPlan {
  readonly action?:
    | {
        readonly href: string;
        readonly label: string;
        /** The page's main action takes the primary button. */
        readonly primary?: boolean | undefined;
      }
    | undefined;
  readonly line: string;
  readonly name: string;
}

/** A row: what it is, and its value in each plan's column. */
interface RateCardRow {
  /** Marks a value as granted in full, with a check. */
  readonly check?: boolean | undefined;
  /** The platforms it covers, by their marks, with the tag that names them. */
  readonly marks?: readonly SiteMark[] | undefined;
  readonly name: string;
  readonly note?: string | undefined;
  readonly tag?: string | undefined;
  /** One per plan, in the plans' order. */
  readonly values: readonly string[];
}

/** Rows under a heading that opens and closes, such as a kind of usage. */
interface RateCardGroup {
  readonly icon: SiteIcon;
  readonly id: string;
  readonly lead?: string | undefined;
  readonly rows: readonly RateCardRow[];
  readonly title: string;
}

interface RateCardProps {
  readonly eyebrow: {
    readonly icon?: SiteIcon | undefined;
    readonly label: string;
  };
  readonly groups: readonly RateCardGroup[];
  /** The headline's id, for the section's `aria-labelledby`. */
  readonly headingId: string;
  /** A line after the groups, such as the taxes, with a link to read on. */
  readonly note?:
    | {
        readonly link?:
          | { readonly href: string; readonly label: string }
          | undefined;
        readonly text: string;
      }
    | undefined;
  readonly plans: readonly RateCardPlan[];
  readonly rows: readonly RateCardRow[];
  readonly title: string;
}

// Thirds, as the plans' cells over the table, so every column line runs on.
const nameCell = "w-1/3 shrink-0 px-6 sm:px-8";

const planCell = "w-1/3 min-w-0 shrink-0 px-6 sm:px-8";

const Row = ({
  plans,
  row,
}: {
  /** The plans' names, in order: each value's key. */
  readonly plans: readonly string[];
  readonly row: RateCardRow;
}) => (
  <div className="flex items-center border-b py-5">
    <div className={nameCell}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-foreground text-[15px] font-medium">{row.name}</p>
        {row.tag === undefined ? null : (
          <span className="text-muted-foreground inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs">
            {row.marks?.map((mark) => (
              <Mark
                key={markKey(mark)}
                mark={mark}
                className="text-muted-foreground size-3.5"
              />
            ))}
            <span className="ms-0.5 whitespace-nowrap">{row.tag}</span>
          </span>
        )}
      </div>
      {row.note === undefined ? null : (
        <p className="text-muted-foreground mt-1.5 text-sm">{row.note}</p>
      )}
    </div>
    {row.values.map((value, index) => (
      <div
        key={plans[index] ?? value}
        className={cn(planCell, "text-sm tabular-nums")}
      >
        <span className="flex items-start gap-2">
          {row.check === true ? (
            <CheckIcon
              aria-hidden="true"
              strokeWidth={2.25}
              className="text-brand mt-px size-4 shrink-0"
            />
          ) : null}
          {value}
        </span>
      </div>
    ))}
  </div>
);

/**
 * What every plan includes and what usage costs (DESIGN.md, Site): a table
 * on the page's grid, its plans' heads sticking under the site's header,
 * a row per feature with the platforms it covers, then a group per kind of
 * usage that opens and closes, as ui-sdk's accordion, closed at first.
 */
const RateCard = ({
  eyebrow,
  groups,
  headingId,
  note,
  plans,
  rows,
  title,
}: RateCardProps) => {
  const planNames = plans.map((plan) => plan.name);

  return (
    <div data-slot="rate-card">
      {/* The table's opening, as every section of the site opens: a
          centred eyebrow and headline over a faint pixel field. */}
      <div className="relative overflow-hidden border-b px-6 py-16 text-center sm:py-20">
        <PixelField />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5">
          <Eyebrow icon={eyebrow.icon} label={eyebrow.label} />
          <SectionHeadline id={headingId} title={{ text: title }} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex border-b">
            <div className={nameCell} />
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(planCell, "flex flex-col gap-4 border-s py-8")}
              >
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold tracking-[-0.01em]">
                    {plan.name}
                  </p>
                  <p className="text-muted-foreground text-sm">{plan.line}</p>
                </div>
                {plan.action === undefined ? null : (
                  <a
                    href={plan.action.href}
                    className={buttonVariants({
                      className: "w-full",
                      variant:
                        plan.action.primary === true ? "default" : "outline",
                    })}
                  >
                    {plan.action.label}
                  </a>
                )}
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <Row key={row.name} plans={planNames} row={row} />
          ))}

          <Accordion multiple hiddenUntilFound>
            {groups.map((group) => (
              <AccordionItem key={group.id} value={group.id}>
                <AccordionHeader className="flex">
                  <AccordionTrigger className="group/rate-group hover:bg-accent/60 focus-visible:ring-ring/50 flex flex-1 items-center gap-4 border-b px-6 py-5 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset sm:px-8">
                    <span className="bg-brand-tint text-brand flex size-10 shrink-0 items-center justify-center rounded-md">
                      <SiteIconView icon={group.icon} className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-foreground text-[15px] font-semibold">
                        {group.title}
                      </span>
                      {group.lead === undefined ? null : (
                        <span className="text-muted-foreground max-w-3xl text-sm">
                          {group.lead}
                        </span>
                      )}
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-data-open/rate-group:rotate-180 motion-reduce:transition-none"
                    />
                  </AccordionTrigger>
                </AccordionHeader>
                <AccordionPanel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
                  {group.rows.map((row) => (
                    <Row key={row.name} plans={planNames} row={row} />
                  ))}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
          {note === undefined ? null : (
            <p className="text-muted-foreground px-6 py-5 text-sm sm:px-8">
              {note.text}
              {note.link === undefined ? null : (
                <>
                  {" "}
                  <a
                    href={note.link.href}
                    className="text-brand-text underline-offset-4 hover:underline"
                  >
                    {note.link.label}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export { RateCard };

export type { RateCardGroup, RateCardPlan, RateCardProps, RateCardRow };
