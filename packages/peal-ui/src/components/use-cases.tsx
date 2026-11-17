"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { MockChip, MockWindow } from "./feature-cell";
import type { MockChipContent, MockRow } from "./feature-cell";
import { SiteIconView } from "./site-icons";
import type { SiteIcon } from "./site-icons";

interface UseCase {
  /** What the demo panel says happens, in a sentence or two. */
  readonly body: string;
  /** The chip over the demo, such as `:: Waiting for approval`. */
  readonly chip: MockChipContent;
  readonly description: string;
  readonly icon: SiteIcon;
  readonly link?: { readonly href: string; readonly label: string } | undefined;
  readonly rows: readonly MockRow[];
  readonly title: string;
  readonly url: string;
  readonly value: string;
}

/**
 * Use cases (DESIGN.md, Site): ui-sdk's vertical tabs, a column of cases
 * on the left, and a demo panel on the right drawn from Peal's own UI.
 * Up and Down move between the cases.
 */
const UseCases = ({
  cases,
  className,
  label,
}: {
  readonly cases: readonly UseCase[];
  readonly className?: string | undefined;
  /** The list's name, such as "Use cases". */
  readonly label: string;
}) => (
  <Tabs
    defaultValue={cases[0]?.value}
    orientation="vertical"
    className={cn(
      "mx-auto grid max-w-6xl border-y md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
      className
    )}
  >
    <TabsList
      aria-label={label}
      className="flex flex-col border-b md:border-e md:border-b-0"
    >
      {cases.map((item) => (
        <TabsTab
          key={item.value}
          value={item.value}
          className="text-muted-foreground hover:bg-accent/60 data-[selected]:bg-muted data-[selected]:text-foreground focus-visible:ring-ring/50 data-[selected]:before:bg-brand relative flex flex-col items-start gap-1 border-b p-5 text-start outline-none last:border-b-0 focus-visible:ring-3 focus-visible:ring-inset data-[selected]:before:absolute data-[selected]:before:inset-y-0 data-[selected]:before:start-0 data-[selected]:before:w-0.5"
        >
          <span className="text-foreground flex items-center gap-2 text-[15px] font-semibold">
            <SiteIconView icon={item.icon} />
            {item.title}
          </span>
          <span className="text-[13px] leading-snug">{item.description}</span>
        </TabsTab>
      ))}
    </TabsList>
    {cases.map((item) => (
      <TabsPanel
        key={item.value}
        value={item.value}
        className="flex flex-col justify-center gap-5 p-6 outline-none sm:p-10"
      >
        <MockChip state={item.chip.state} text={item.chip.text} />
        <MockWindow rows={item.rows} url={item.url} />
        <p className="text-muted-foreground text-sm leading-relaxed">
          {item.body}
        </p>
        {item.link === undefined ? null : (
          <a
            href={item.link.href}
            className="text-brand-text focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3"
          >
            {item.link.label}
            <ChevronRightIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4"
            />
          </a>
        )}
      </TabsPanel>
    ))}
  </Tabs>
);

export { UseCases };

export type { UseCase };
