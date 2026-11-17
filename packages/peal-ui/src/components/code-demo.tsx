"use client";

import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type * as React from "react";

import { cn } from "../lib/utils";
import { SiteIconView } from "./site-icons";
import type { SiteIcon } from "./site-icons";

interface CodeBlock {
  readonly code: string;
  /** A short mono caption over the block, such as `request` or `.json`. */
  readonly label: string;
}

interface CodeDemoTab {
  readonly icon?: SiteIcon | undefined;
  readonly label: string;
  readonly request: CodeBlock;
  readonly response: CodeBlock;
  readonly value: string;
}

const Code = ({
  action,
  block,
}: {
  readonly action?: React.ReactNode;
  readonly block: CodeBlock;
}) => (
  <figure className="flex h-full min-w-0 flex-col">
    <figcaption className="text-muted-foreground flex h-11 items-center justify-between gap-2 border-b ps-4 pe-1.5 font-mono text-xs tracking-[0.04em]">
      [ {block.label} ]{action}
    </figcaption>
    <pre className="bg-muted text-foreground flex-1 overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
      <code>{block.code}</code>
    </pre>
  </figure>
);

const CopyButton = ({
  copied,
  copy,
  text,
}: {
  readonly copied: string;
  readonly copy: string;
  readonly text: string;
}) => {
  const [done, setDone] = useState(false);

  // The label says it copied for two seconds.
  useEffect(() => {
    const timer = done
      ? setTimeout(() => {
          setDone(false);
        }, 2000)
      : undefined;

    return () => {
      clearTimeout(timer);
    };
  }, [done]);

  return (
    <ButtonPrimitive
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
      }}
    >
      {done ? (
        <CheckIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      ) : (
        <CopyIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      )}
      {done ? copied : copy}
    </ButtonPrimitive>
  );
};

/**
 * A request and its answer, one tab per way in (DESIGN.md, Site): ui-sdk's
 * tabs over a bordered panel, the request on the left and the response on
 * the right, both on `muted`, with a button that copies the request.
 */
const CodeDemo = ({
  className,
  copied,
  copy,
  label,
  tabs,
}: {
  readonly className?: string | undefined;
  /** The copy button's label once it copied. */
  readonly copied: string;
  readonly copy: string;
  /** The tab list's name, such as "Ways to publish". */
  readonly label: string;
  readonly tabs: readonly CodeDemoTab[];
}) => (
  <Tabs
    defaultValue={tabs[0]?.value}
    className={cn("bg-card mx-auto max-w-6xl border-y", className)}
  >
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-2">
      <TabsList aria-label={label} className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <TabsTab
            key={tab.value}
            value={tab.value}
            className="text-muted-foreground hover:text-foreground data-[selected]:bg-muted data-[selected]:text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-3"
          >
            {tab.icon === undefined ? null : <SiteIconView icon={tab.icon} />}
            {tab.label}
          </TabsTab>
        ))}
      </TabsList>
    </div>
    {tabs.map((tab) => (
      <TabsPanel key={tab.value} value={tab.value} className="outline-none">
        <div className="grid md:grid-cols-2">
          <div className="min-w-0 border-b md:border-e md:border-b-0">
            <Code
              block={tab.request}
              action={
                <CopyButton
                  copied={copied}
                  copy={copy}
                  text={tab.request.code}
                />
              }
            />
          </div>
          <Code block={tab.response} />
        </div>
      </TabsPanel>
    ))}
  </Tabs>
);

export { CodeDemo };

export type { CodeBlock, CodeDemoTab };
