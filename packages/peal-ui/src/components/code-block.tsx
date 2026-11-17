"use client";

import { announce } from "@ui-sdk/core";
import { Button as ButtonPrimitive } from "@ui-sdk/react/button";
import {
  ScrollArea,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type * as React from "react";

import { useCodeLanguage } from "../hooks/use-code-language";
import "../lib/css-properties";
import { decodeHighlighted, highlightedSource } from "../lib/highlighted-code";
import type { CodeTokenKind } from "../lib/highlighted-code";
import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

/**
 * One language's code, highlighted before it reaches the page: the
 * component only lays the runs out, so no highlighter ships to the browser.
 */
interface CodeSample {
  /** A file's name or a caption, such as `publish.ts` or `201 Created`. */
  readonly filename?: string | undefined;
  /** A lucide icon, where the language has no brand mark. */
  readonly icon?: SiteIcon | undefined;
  /** The language's name, such as `TypeScript`. */
  readonly label: string;
  /**
   * The code's lines of runs, as `encodeHighlighted` (peal-ui's
   * lib/highlighted-code) writes them. Copy copies their text.
   */
  readonly highlighted: string;
  /** The language's mark, from simple-icons, or a lettered tile. */
  readonly mark?: SiteMark | undefined;
  /**
   * The language's key, the same in every block: picking `python` in one
   * shows Python in every block that has it.
   */
  readonly value: string;
}

interface CodeBlockContent {
  /** The Copy button's label once it copied, also announced. */
  readonly copied: string;
  readonly copy: string;
  /** The language switcher's name, such as "Language". */
  readonly label: string;
  /** Numbers each line, in a column that stays put as the code scrolls. */
  readonly lineNumbers?: boolean | undefined;
  /**
   * What the request answers, beside it from 48 rem of block width and
   * under it below: one sample, the same whatever the language.
   */
  readonly response?: CodeSample | undefined;
  /** The request in each language; the first shows until one is picked. */
  readonly samples: readonly CodeSample[];
}

const kindClass: Record<CodeTokenKind, string> = {
  comment: "text-code-comment",
  constant: "text-code-constant",
  deleted: "text-code-deleted",
  keyword: "text-code-keyword",
  punctuation: "text-code-punctuation",
  string: "text-code-string",
  type: "text-code-type",
};

const LanguageMark = ({
  className,
  sample,
}: {
  readonly className?: string | undefined;
  readonly sample: CodeSample;
}) => {
  if (sample.mark !== undefined) {
    return <Mark mark={sample.mark} className={className} />;
  }

  return sample.icon === undefined ? null : (
    <SiteIconView icon={sample.icon} className={className} />
  );
};

/**
 * The lines on `muted`, in ui-sdk's scroll area. A long line scrolls
 * sideways inside the block, over a thin scrollbar shown whenever it
 * overflows, and never wraps: code keeps the shape it is copied in, and
 * line numbers stay level with their lines. The viewport becomes a tab stop
 * while it scrolls, so the keyboard reaches what is past the edge.
 */
const Lines = ({
  label,
  lineNumbers,
  minLines,
  sample,
}: {
  readonly label: string;
  readonly lineNumbers: boolean;
  /**
   * The lines it is as tall as, at least, from 48 rem of block width, so
   * switching keeps its height; narrower, each language takes its own.
   */
  readonly minLines?: number | undefined;
  readonly sample: CodeSample;
}) => {
  const lines = useMemo(
    () => decodeHighlighted(sample.highlighted),
    [sample.highlighted]
  );

  return (
    <ScrollArea type="auto" className="bg-code-background flex min-w-0 flex-1">
      <ScrollAreaViewport
        render={<section />}
        aria-label={label}
        className="focus-visible:ring-ring/50 w-full outline-none focus-visible:ring-3 focus-visible:ring-inset"
      >
        <pre
          style={{ "--code-lines": String(minLines ?? 0) }}
          className="text-code-foreground py-4 font-mono text-[13px] leading-relaxed @min-[48rem]:min-h-[calc(var(--code-lines)*1lh+2rem)]"
        >
          <code className="block w-max min-w-full">
            {lines.map((runs, index) => {
              const number = index + 1;

              return (
                <span key={number} className="flex pe-4">
                  {lineNumbers ? (
                    <span
                      aria-hidden="true"
                      className="bg-code-background text-code-comment sticky start-0 w-[5ch] shrink-0 ps-[1ch] pe-[1.5ch] text-end select-none"
                    >
                      {number}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="w-4 shrink-0" />
                  )}
                  <span className="whitespace-pre">
                    {runs.map((run) => (
                      <span
                        key={run.offset}
                        className={
                          run.kind === undefined
                            ? undefined
                            : kindClass[run.kind]
                        }
                      >
                        {run.text}
                      </span>
                    ))}
                    {"\n"}
                  </span>
                </span>
              );
            })}
          </code>
        </pre>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        orientation="horizontal"
        className="h-1.5 px-1 pb-0.5"
      >
        <ScrollAreaThumb className="bg-input h-full rounded-full" />
      </ScrollAreaScrollbar>
    </ScrollArea>
  );
};

const Caption = ({ children }: { readonly children: React.ReactNode }) => (
  <span className="text-muted-foreground flex h-9 items-center border-b px-4 font-mono text-xs tracking-[0.04em]">
    {children}
  </span>
);

/** Copies `text`, says so for two seconds, and announces it politely. */
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
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // The browser refused the clipboard: the code stays selectable.
          return;
        }

        setDone(true);
        announce(copied);
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

const tabClass =
  "text-muted-foreground hover:text-foreground data-[selected]:bg-muted data-[selected]:text-foreground focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3";

/**
 * The language switcher: ui-sdk's tabs where they fit on one line, from
 * 60 rem of block width, and ui-sdk's select below, so ten languages never
 * wrap or scroll out of sight.
 */
const Switcher = ({
  label,
  samples,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly onSelect: (value: string) => void;
  readonly samples: readonly CodeSample[];
  readonly selected: CodeSample;
}) => (
  <>
    <TabsList
      aria-label={label}
      className="hidden min-w-0 gap-1 @min-[60rem]:flex"
    >
      {samples.map((sample) => (
        <TabsTab key={sample.value} value={sample.value} className={tabClass}>
          <LanguageMark sample={sample} />
          {sample.label}
        </TabsTab>
      ))}
    </TabsList>
    <div className="min-w-0 @min-[60rem]:hidden">
      <Select
        value={selected.value}
        onValueChange={(value) => {
          if (value !== null) {
            onSelect(value);
          }
        }}
      >
        <SelectTrigger aria-label={label} className="h-8 max-w-full">
          <SelectValue>
            <LanguageMark sample={selected} />
            {selected.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {samples.map((sample) => (
            // The list names each language; its mark shows on the trigger.
            <SelectItem
              key={sample.value}
              value={sample.value}
              label={sample.label}
            >
              {sample.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </>
);

/**
 * A block of code (DESIGN.md, Site): a header with the language switcher,
 * or the one language's name, and a Copy button; the code, highlighted at
 * build time, on `muted`; and, for a request, its response beside it. The
 * language picked is the page's: every block shows it where it has it, and
 * the reader's next visit opens on it.
 */
const CodeBlock = ({
  className,
  copied,
  copy,
  label,
  lineNumbers = false,
  response,
  samples,
}: CodeBlockContent & { readonly className?: string | undefined }) => {
  const [language, choose] = useCodeLanguage();

  const [first] = samples;

  const selected = samples.find((sample) => sample.value === language) ?? first;

  if (selected === undefined) {
    return null;
  }

  const several = samples.length > 1;

  // Lines are counted from their separators, without decoding them.
  const minLines = several
    ? Math.max(
        ...samples.map((sample) => sample.highlighted.split("\n").length)
      )
    : undefined;

  const header = (
    <div className="flex min-h-12 items-center justify-between gap-2 border-b px-2 py-2">
      {several ? (
        <Switcher
          label={label}
          samples={samples}
          selected={selected}
          onSelect={choose}
        />
      ) : (
        <span className="text-muted-foreground flex min-w-0 items-center gap-2 ps-2 font-mono text-xs tracking-[0.04em]">
          <LanguageMark sample={selected} className="text-foreground" />
          <span className="truncate">
            {selected.filename ?? selected.label}
          </span>
        </span>
      )}
      <CopyButton
        copied={copied}
        copy={copy}
        text={highlightedSource(selected.highlighted)}
      />
    </div>
  );

  const request = (sample: CodeSample) => (
    <div className="flex h-full min-w-0 flex-col">
      {response === undefined || sample.filename === undefined ? null : (
        <Caption>{sample.filename}</Caption>
      )}
      <Lines
        label={sample.filename ?? sample.label}
        lineNumbers={lineNumbers}
        minLines={minLines}
        sample={sample}
      />
    </div>
  );

  const body = (
    <div
      className={cn(
        "grid min-w-0",
        response === undefined ? null : "@min-[48rem]:grid-cols-2"
      )}
    >
      {several ? (
        <div className="min-w-0">
          {samples.map((sample) => (
            <TabsPanel
              key={sample.value}
              value={sample.value}
              keepMounted
              className="h-full outline-none"
            >
              {request(sample)}
            </TabsPanel>
          ))}
        </div>
      ) : (
        request(selected)
      )}
      {response === undefined ? null : (
        <div className="flex min-w-0 flex-col border-t @min-[48rem]:border-s @min-[48rem]:border-t-0">
          {response.filename === undefined ? null : (
            <Caption>{response.filename}</Caption>
          )}
          <Lines
            label={response.filename ?? response.label}
            lineNumbers={lineNumbers}
            sample={response}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      data-slot="code-block"
      className={cn(
        "bg-card @container min-w-0 overflow-hidden rounded-md border",
        className
      )}
    >
      {several ? (
        <Tabs
          value={selected.value}
          onValueChange={(value) => {
            if (value !== null) {
              choose(value);
            }
          }}
        >
          {header}
          {body}
        </Tabs>
      ) : (
        <>
          {header}
          {body}
        </>
      )}
    </div>
  );
};

export { CodeBlock };

export type { CodeBlockContent, CodeSample };
