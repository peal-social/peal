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
import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";

import { useCodeLanguage } from "../hooks/use-code-language";
import { highlightedLineCount } from "../lib/highlighted-code";
import { cn } from "../lib/utils";
import { codeLinesSource } from "./code-lines";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Mark, SiteIconView } from "./site-icons";
import type { SiteIcon, SiteMark } from "./site-icons";

// The page renders a block's code once, on the server, with CodeLines, and
// hands it to this island in its slots (`panel0`, `panel1`, … and
// `responseCode`): the island's props name the languages, never the code,
// and switching shows another panel without rendering a line.

/** A language a block offers, as its switcher names it. */
interface CodeChoice {
  /** A file's name or a caption, such as `publish.ts` or `201 Created`. */
  readonly filename?: string | undefined;
  /** A lucide icon, where the language has no brand mark. */
  readonly icon?: SiteIcon | undefined;
  /** The language's name, such as `TypeScript`. */
  readonly label: string;
  /** The language's mark, from simple-icons, or a lettered tile. */
  readonly mark?: SiteMark | undefined;
  /**
   * The language's key, the same in every block: picking `python` in one
   * shows Python in every block that has it.
   */
  readonly value: string;
}

/**
 * One language's code, highlighted before it reaches the page: CodeLines
 * lays the runs out on the server, so no highlighter ships to the browser.
 */
interface CodeSample extends CodeChoice {
  /**
   * The code's lines of runs, as `encodeHighlighted` (peal-ui's
   * lib/highlighted-code) writes them. Copy copies their text.
   */
  readonly highlighted: string;
}

/** A block of code, as the page writes it. */
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

/** The island's props: the block's words and its languages, no code. */
interface CodeBlockProps {
  readonly className?: string | undefined;
  readonly copied: string;
  readonly copy: string;
  readonly label: string;
  readonly response?: CodeChoice | undefined;
  readonly samples: readonly CodeChoice[];
}

/** The slot a request's lines come in: `panel0` for the first language. */
type CodePanelSlot = `panel${number}`;

/** The block's code, each slot holding CodeLines rendered on the server. */
type CodeBlockSlots = Readonly<
  Partial<Record<CodePanelSlot, React.ReactNode>>
> & {
  readonly responseCode?: React.ReactNode;
};

const panelSlot = (index: number): CodePanelSlot => `panel${index}`;

const choiceOf = (sample: CodeSample): CodeChoice => ({
  filename: sample.filename,
  icon: sample.icon,
  label: sample.label,
  mark: sample.mark,
  value: sample.value,
});

/**
 * A block as the page lays it out: the island's props, which carry no
 * code, and the lines CodeLines renders into each of its slots.
 */
const codeBlockParts = (content: CodeBlockContent) => {
  const lineNumbers = content.lineNumbers ?? false;

  // From 48 rem, every language is as tall as the longest.
  const minLines =
    content.samples.length > 1
      ? Math.max(
          ...content.samples.map((sample) =>
            highlightedLineCount(sample.highlighted)
          )
        )
      : undefined;

  const props: CodeBlockProps = {
    copied: content.copied,
    copy: content.copy,
    label: content.label,
    // A response shows its caption only, never its mark.
    response:
      content.response === undefined
        ? undefined
        : {
            filename: content.response.filename,
            label: content.response.label,
            value: content.response.value,
          },
    samples: content.samples.map((sample) => choiceOf(sample)),
  };

  return {
    panels: content.samples.map((sample, index) => ({
      lines: { highlighted: sample.highlighted, lineNumbers, minLines },
      slot: panelSlot(index),
    })),
    props,
    // In the `responseCode` slot.
    response:
      content.response === undefined
        ? undefined
        : {
            lines: { highlighted: content.response.highlighted, lineNumbers },
          },
  };
};

const LanguageMark = ({
  className,
  sample,
}: {
  readonly className?: string | undefined;
  readonly sample: CodeChoice;
}) => {
  if (sample.mark !== undefined) {
    return <Mark mark={sample.mark} className={className} />;
  }

  return sample.icon === undefined ? null : (
    <SiteIconView icon={sample.icon} className={className} />
  );
};

/**
 * A pane of code on `muted`. The one showing scrolls in ui-sdk's scroll
 * area: a long line scrolls sideways inside the block, over a thin
 * scrollbar shown whenever it overflows, and the viewport becomes a tab
 * stop while it scrolls, so the keyboard reaches what is past the edge.
 * A hidden language's pane is a plain box until it shows, so the page keeps
 * one scroll area per pane on screen.
 */
const Pane = ({
  children,
  label,
  showing,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
  readonly showing: boolean;
}) =>
  showing ? (
    <ScrollArea type="auto" className="bg-code-background flex min-w-0 flex-1">
      <ScrollAreaViewport
        render={<section />}
        aria-label={label}
        className="focus-visible:ring-ring/50 w-full outline-none focus-visible:ring-3 focus-visible:ring-inset"
      >
        {children}
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        orientation="horizontal"
        className="h-1.5 px-1 pb-0.5"
      >
        <ScrollAreaThumb className="bg-input h-full rounded-full" />
      </ScrollAreaScrollbar>
    </ScrollArea>
  ) : (
    <div className="bg-code-background flex min-w-0 flex-1">
      <section aria-label={label} className="w-full overflow-hidden">
        {children}
      </section>
    </div>
  );

const Caption = ({ children }: { readonly children: React.ReactNode }) => (
  <span className="text-muted-foreground flex h-9 items-center border-b px-4 font-mono text-xs tracking-[0.04em]">
    {children}
  </span>
);

/** Copies the source, says so for two seconds, and announces it politely. */
const CopyButton = ({
  copied,
  copy,
  source,
}: {
  readonly copied: string;
  readonly copy: string;
  /** The plain source of the code showing, read when pressed. */
  readonly source: () => string;
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
          await navigator.clipboard.writeText(source());
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
  readonly samples: readonly CodeChoice[];
  readonly selected: CodeChoice;
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
 * build time and rendered on the server, on `muted`; and, for a request,
 * its response beside it. The language picked is the page's: every block
 * shows it where it has it, and the reader's next visit opens on it.
 */
const CodeBlock = (props: CodeBlockProps & CodeBlockSlots) => {
  const { className, copied, copy, label, response, samples } = props;

  const [language, choose] = useCodeLanguage();

  const root = useRef<HTMLDivElement>(null);

  const [first] = samples;

  const selected = samples.find((sample) => sample.value === language) ?? first;

  const selectedValue = selected?.value;

  // Read from the panel showing, whose lines the server rendered.
  const source = useCallback(() => {
    const panel = [
      ...(root.current?.querySelectorAll<HTMLElement>("[data-code-panel]") ??
        []),
    ].find((element) => element.dataset["codePanel"] === selectedValue);

    return panel === undefined ? "" : codeLinesSource(panel);
  }, [selectedValue]);

  if (selected === undefined) {
    return null;
  }

  const several = samples.length > 1;

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
      <CopyButton copied={copied} copy={copy} source={source} />
    </div>
  );

  const request = (sample: CodeChoice, index: number) => (
    <div
      data-code-panel={sample.value}
      className="flex h-full min-w-0 flex-col"
    >
      {response === undefined || sample.filename === undefined ? null : (
        <Caption>{sample.filename}</Caption>
      )}
      <Pane
        label={sample.filename ?? sample.label}
        showing={sample.value === selected.value}
      >
        {props[panelSlot(index)]}
      </Pane>
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
          {samples.map((sample, index) => (
            <TabsPanel
              key={sample.value}
              value={sample.value}
              keepMounted
              className="h-full outline-none"
            >
              {request(sample, index)}
            </TabsPanel>
          ))}
        </div>
      ) : (
        request(selected, 0)
      )}
      {response === undefined ? null : (
        <div className="flex min-w-0 flex-col border-t @min-[48rem]:border-s @min-[48rem]:border-t-0">
          {response.filename === undefined ? null : (
            <Caption>{response.filename}</Caption>
          )}
          <Pane label={response.filename ?? response.label} showing>
            {props.responseCode}
          </Pane>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={root}
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

export { CodeBlock, codeBlockParts };

export type {
  CodeBlockContent,
  CodeBlockProps,
  CodeBlockSlots,
  CodeChoice,
  CodePanelSlot,
  CodeSample,
};
