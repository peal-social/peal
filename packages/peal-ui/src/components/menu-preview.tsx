"use client";

import { definePrimitive } from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { PixelIcon } from "../blocks/art/pixel-icon";
import { cn } from "../lib/utils";
import { BrandField } from "./brand-field";

interface MenuPreviewState {
  /** The previewed row's key, or null for the card's own content. */
  readonly current: string | null;
}

// The row an event happened in, by its `data-preview-key`.
const rowKey = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest<HTMLElement>("[data-preview-key]")?.dataset[
        "previewKey"
      ] ?? null)
    : null;

// Which row a menu's preview shows: the one the pointer rests on or focus is
// in, inside the panel, and none once both have left it. The menu's links
// keep their own keyboard handling; this only follows it.
const definition = definePrimitive({
  api: (context) => ({
    preview: (key: string | null) => {
      if (context.store.get().current !== key) {
        context.store.set({ current: key });
      }
    },
  }),
  name: "menu-preview",
  options: {},
  slots: (slot) => ({
    root: slot<object, MenuPreviewState>({
      on: {
        focusin: (event, { api }) => {
          api.preview(rowKey(event.target));
        },
        focusout: (event, { api, el }) => {
          const next = event instanceof FocusEvent ? event.relatedTarget : null;

          if (!(next instanceof Node) || el?.contains(next) !== true) {
            api.preview(null);
          }
        },
        pointerleave: (_event, { api, el }) => {
          api.preview(rowKey(el?.ownerDocument.activeElement ?? null));
        },
        pointerover: (event, { api }) => {
          const key = rowKey(event.target);

          if (key !== null) {
            api.preview(key);
          }
        },
      },
      state: (state) => ({ current: state.current }),
    }),
  }),
  state: (): MenuPreviewState => ({ current: null }),
});

// definePrimitive types `options` as possibly undefined, which ui-sdk's
// `Primitive` refuses under exactOptionalPropertyTypes; it has none.
const menuPreview = Object.assign(definition, { options: {} });

const { Root } = createParts(menuPreview, { root: "div" });

/** What the card says under its art: a headline and a line or two. */
interface MenuPreviewIntro {
  readonly body: string;
  readonly headline: string;
}

/** A row the preview can show, by the key its row carries. */
interface MenuPreviewItem extends MenuPreviewIntro {
  /** The row's icon or mark, as an SVG, which the card rasterises. */
  readonly art?: React.ReactNode;
  readonly key: string;
}

/** What the card shows while no row is previewed. */
interface MenuPreviewFallback extends MenuPreviewIntro {
  /** Its art: an SVG, such as a brand's mark, which the card rasterises. */
  readonly art: React.ReactNode;
  /** Cells across the art, for a drawing larger than a row's icon. */
  readonly cells?: 34 | 48 | undefined;
}

// Every intro sits in the same grid cell and only the current one shows,
// so the card keeps the height of the longest and never jumps.
const Intro = ({
  intro,
  shown,
}: {
  readonly intro: MenuPreviewIntro;
  readonly shown: boolean;
}) => (
  <span
    className={cn(
      "col-start-1 row-start-1 flex flex-col gap-1",
      shown ? undefined : "invisible"
    )}
  >
    <span className="text-foreground text-[15px] font-semibold">
      {intro.headline}
    </span>
    <span className="text-muted-foreground text-[13px] leading-snug">
      {intro.body}
    </span>
  </span>
);

/**
 * A mega menu's preview (DESIGN.md, Site): its rows, then a card whose
 * pixel art and intro follow the row the pointer rests on or focus is in,
 * and show the card's own art and intro otherwise. The card is not a link
 * and screen readers skip it: the rows are the links. Rows name themselves
 * with `data-preview-key`, and each item carries its row's icon as art.
 */
const MenuPreview = ({
  children,
  className,
  fallback,
  items,
}: {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  readonly fallback: MenuPreviewFallback;
  readonly items: readonly MenuPreviewItem[];
}) => (
  <Root className={cn("flex gap-2", className)}>
    {({ current }: MenuPreviewState) => {
      const item = items.find((candidate) => candidate.key === current);

      return (
        <>
          {children}
          <div
            aria-hidden="true"
            data-slot="menu-preview-card"
            className="bg-muted flex w-72 flex-col gap-3 rounded-md border p-2"
          >
            <BrandField rails={false} className="min-h-56 flex-1 rounded-md">
              {item?.art === undefined ? (
                <PixelIcon
                  animate
                  artKey="fallback"
                  cells={fallback.cells}
                  className="absolute inset-0"
                  on="field"
                >
                  {fallback.art}
                </PixelIcon>
              ) : (
                <PixelIcon
                  animate
                  artKey={item.key}
                  className="absolute inset-0"
                  on="field"
                >
                  {item.art}
                </PixelIcon>
              )}
            </BrandField>
            <span className="grid px-2 pb-2">
              <Intro intro={fallback} shown={item === undefined} />
              {items.map((candidate) => (
                <Intro
                  key={candidate.key}
                  intro={candidate}
                  shown={candidate === item}
                />
              ))}
            </span>
          </div>
        </>
      );
    }}
  </Root>
);

export { MenuPreview };

export type { MenuPreviewFallback, MenuPreviewIntro, MenuPreviewItem };
