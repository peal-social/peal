"use client";

import { PlusIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "peal-ui/components/input-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "peal-ui/components/sheet";
import { useId, useState } from "react";

import { kinds, matches, widgetKinds } from "#analytics/widgets.ts";
import type { WidgetKind, WidgetSection } from "#analytics/widgets.ts";

const sections: readonly WidgetSection[] = [
  "suggested",
  "audience",
  "posts",
  "files",
];

type Art = "bars" | "file" | "grid" | "line" | "list" | "number" | "tiles";

const artOf: Readonly<Record<WidgetKind, Art>> = {
  activity: "bars",
  bestTimes: "grid",
  channels: "list",
  clicks: "number",
  comparison: "tiles",
  engagement: "line",
  export: "file",
  followers: "line",
  impressions: "number",
  platforms: "list",
  posts: "number",
  reach: "number",
  saves: "number",
  topPosts: "list",
  views: "line",
};

// The drawings' bars and lines, as classes the theme knows.
const barHeights = [
  "h-1/3",
  "h-1/2",
  "h-1/4",
  "h-3/5",
  "h-2/5",
  "h-2/3",
  "h-1/2",
];

const lineWidths = ["w-16", "w-12", "w-14"];

// A drawing of what a widget shows, in the theme's ink, muted and blue.
const WidgetArt = ({ art }: { readonly art: Art }) => {
  const frame =
    "bg-card flex h-16 w-24 shrink-0 flex-col justify-center gap-1.5 rounded-md border px-2.5";

  switch (art) {
    case "line": {
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 128 80"
          className="bg-card h-16 w-24 shrink-0 rounded-md border"
        >
          <path
            d="M8 60 L30 56 L48 40 L66 44 L84 26 L102 30 L120 18 L120 72 L8 72 Z"
            className="fill-brand/10"
          />
          <path
            d="M8 60 L30 56 L48 40 L66 44 L84 26 L102 30 L120 18"
            fill="none"
            strokeWidth="2"
            className="stroke-brand"
          />
        </svg>
      );
    }

    case "bars": {
      return (
        <div aria-hidden="true" className={`${frame} flex-row items-end pb-3`}>
          {barHeights.map((height, index) => (
            <span
              key={index}
              className={`bg-brand/70 w-2.5 rounded-sm ${height}`}
            />
          ))}
        </div>
      );
    }

    case "number": {
      return (
        <div aria-hidden="true" className={frame}>
          <span className="text-base font-semibold tabular-nums">1,284</span>
          <span className="bg-brand h-1 w-14 rounded-full" />
          <span className="bg-muted h-1 w-12 rounded-full" />
        </div>
      );
    }

    case "list": {
      return (
        <div aria-hidden="true" className={frame}>
          {lineWidths.map((width, index) => (
            <span key={index} className="flex items-center gap-2">
              <span className="bg-muted size-3 rounded-full" />
              <span className={`bg-muted h-1.5 rounded-full ${width}`} />
              <span className="bg-brand/60 ml-auto h-1.5 w-4 rounded-full" />
            </span>
          ))}
        </div>
      );
    }

    case "tiles": {
      return (
        <div aria-hidden="true" className={`${frame} grid grid-cols-2 gap-1`}>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="flex flex-col gap-0.5 rounded-sm border p-1"
            >
              <span className="bg-foreground/70 h-1.5 w-6 rounded-full" />
              <span className="bg-brand h-1 w-4 rounded-full" />
            </span>
          ))}
        </div>
      );
    }

    case "grid": {
      return (
        <div
          aria-hidden="true"
          className={`${frame} grid grid-cols-8 gap-0.5 py-3`}
        >
          {Array.from({ length: 32 }, (_, index) => (
            <span
              key={index}
              className={
                [3, 10, 12, 21, 27].includes(index)
                  ? "bg-brand aspect-square rounded-xs"
                  : "bg-muted aspect-square rounded-xs"
              }
            />
          ))}
        </div>
      );
    }

    case "file": {
      return (
        <div aria-hidden="true" className={frame}>
          <span className="flex items-center gap-2">
            <span className="bg-brand-tint text-brand-text rounded-sm px-1 font-mono text-xs">
              CSV
            </span>
            <span className="bg-muted h-1.5 w-12 rounded-full" />
          </span>
          <span className="bg-muted h-1.5 w-16 rounded-full" />
          <span className="bg-muted h-1.5 w-10 rounded-full" />
        </div>
      );
    }

    default: {
      return art satisfies never;
    }
  }
};

/**
 * The sheet **Add widgets** opens, from the page's actions: every kind of
 * widget by section, searched by name and what it shows, each a card that adds
 * one to the board's end; **Reset layout** at its foot.
 */
export const AddWidgets = ({
  onAdd,
  onOpenChange,
  onReset,
  open,
}: {
  readonly onAdd: (kind: WidgetKind) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReset: () => void;
  readonly open: boolean;
}) => {
  const t = useTranslations("Analytics.widgets");
  const searchId = useId();
  const [query, setQuery] = useState("");

  const shown = (kind: WidgetKind) =>
    matches(query, t("name", { kind }), t("about", { kind }));

  const found = widgetKinds.filter(shown);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
        }

        onOpenChange(next);
      }}
    >
      <SheetContent closeLabel={t("close")}>
        <SheetHeader>
          <SheetTitle>{t("add")}</SheetTitle>
          <SheetDescription>{t("panelDescription")}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id={searchId}
              type="search"
              placeholder={t("search")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </InputGroup>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          {found.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noMatch", { query })}
            </p>
          ) : null}
          {sections.map((section) => {
            // Searching lists each kind once, under its first section.
            const listed = found.filter((kind) =>
              query.trim() === ""
                ? kinds[kind].sections.includes(section)
                : kinds[kind].sections[0] === section
            );

            if (listed.length === 0) {
              return null;
            }

            return (
              <section
                key={section}
                aria-labelledby={`${searchId}-${section}`}
                className="flex flex-col gap-3"
              >
                <h3
                  id={`${searchId}-${section}`}
                  className="text-muted-foreground text-xs"
                >
                  {t("section", { section })}
                </h3>
                <ul className="grid grid-cols-1 gap-3">
                  {listed.map((kind) => (
                    <li key={kind}>
                      <button
                        type="button"
                        aria-label={t("addThis", {
                          name: t("name", { kind }),
                        })}
                        onClick={() => {
                          onAdd(kind);
                        }}
                        className="group/add bg-muted/50 hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-4 rounded-lg border p-3 text-left outline-none focus-visible:ring-3"
                      >
                        <WidgetArt art={artOf[kind]} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            {t("name", { kind })}
                            <PlusIcon
                              aria-hidden
                              className="text-muted-foreground group-hover/add:text-foreground size-4 shrink-0"
                            />
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {t("about", { kind })}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <div className="flex border-t p-4">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcwIcon aria-hidden />
            {t("reset")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
