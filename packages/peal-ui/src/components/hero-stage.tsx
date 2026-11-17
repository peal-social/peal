"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { CodeBlock } from "./code-block";
import type { CodeBlockContent } from "./code-block";
import { ComposerMock } from "./composer-mock";
import type { ComposerMockProps } from "./composer-mock";
import { PealMark } from "./peal-mark";
import { SiteIconView } from "./site-icons";
import type { SiteIcon } from "./site-icons";

/** A feature of the selected product, linking to its docs page. */
interface StageChip {
  readonly href: string;
  readonly icon: SiteIcon;
  readonly label: string;
}

type StageContent =
  | {
      readonly composer: ComposerMockProps;
      readonly kind: "composer";
    }
  | {
      /** A request in every way in, beside its response. */
      readonly block: CodeBlockContent;
      readonly kind: "code";
    };

interface StageTab {
  readonly chips: readonly StageChip[];
  /** The chips' list name, such as "PealStudio in the docs". */
  readonly chipsLabel: string;
  readonly content: StageContent;
  readonly label: string;
  /**
   * The mark's tile: white for the team's side, ink for the developers',
   * as the app's mode switch draws Studio and Console.
   */
  readonly tile: "ink" | "light";
  readonly value: string;
}

const Content = ({ content }: { readonly content: StageContent }) =>
  content.kind === "composer" ? (
    <div className="p-3 sm:p-4">
      <ComposerMock {...content.composer} />
    </div>
  ) : (
    <CodeBlock {...content.block} className="rounded-none border-0" />
  );

/**
 * The home page's stage (DESIGN.md, Site): the hero's one `background`
 * panel on the brand field, with ui-sdk's tabs as a segmented switch
 * between the two products, the selected one's demo, and a row of chips
 * for its features, each linking to its docs page.
 */
const HeroStage = ({
  className,
  label,
  tabs,
}: {
  readonly className?: string | undefined;
  /** The switch's name, such as "Peal's products". */
  readonly label: string;
  readonly tabs: readonly StageTab[];
}) => (
  <Tabs
    data-slot="hero-stage"
    defaultValue={tabs[0]?.value}
    className={cn("bg-background text-foreground rounded-md", className)}
  >
    <div className="p-2">
      <TabsList
        aria-label={label}
        className="bg-muted grid grid-cols-2 gap-1 rounded-md p-1"
      >
        {tabs.map((tab) => (
          <TabsTab
            key={tab.value}
            value={tab.value}
            className="text-muted-foreground hover:text-foreground data-[selected]:bg-card data-[selected]:text-foreground focus-visible:ring-ring/50 inline-flex h-9 items-center justify-center gap-2 rounded-[5px] px-3 text-sm font-medium outline-none focus-visible:ring-3 data-[selected]:shadow-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 items-center justify-center rounded-sm",
                tab.tile === "ink" ? "bg-foreground" : "bg-card border"
              )}
            >
              <PealMark className="size-3.5" />
            </span>
            {tab.label}
          </TabsTab>
        ))}
      </TabsList>
    </div>
    {tabs.map((tab) => (
      <TabsPanel
        key={tab.value}
        value={tab.value}
        className="border-t outline-none"
      >
        <Content content={tab.content} />
        <ul
          aria-label={tab.chipsLabel}
          className="flex flex-wrap gap-2 border-t p-3 sm:px-4"
        >
          {tab.chips.map((chip) => (
            <li key={chip.href + chip.label}>
              <a
                href={chip.href}
                className="bg-card text-foreground hover:bg-accent focus-visible:ring-ring/50 group/chip inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[13px] font-medium outline-none focus-visible:ring-3"
              >
                <SiteIconView
                  icon={chip.icon}
                  className="text-muted-foreground size-3.5"
                />
                {chip.label}
                <ArrowUpRightIcon
                  aria-hidden="true"
                  strokeWidth={2}
                  className="text-muted-foreground size-3 transition-transform group-hover/chip:translate-x-px group-hover/chip:-translate-y-px motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>
      </TabsPanel>
    ))}
  </Tabs>
);

export { HeroStage };

export type { StageChip, StageContent, StageTab };
