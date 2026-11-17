"use client";

import { definePrimitive } from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";
import { useEffect, useRef } from "react";
import type * as React from "react";

import { createPixelArt, rasterise } from "../lib/pixel-icon";
import type { PixelArt, PixelIcon } from "../lib/pixel-icon";
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
  readonly key: string;
}

/** What the card shows while no row is previewed. */
interface MenuPreviewFallback extends MenuPreviewIntro {
  /** Its art: an SVG, such as a brand's mark, which the card rasterises. */
  readonly art: React.ReactNode;
  /** Cells across the art, for a drawing larger than a row's icon. */
  readonly cells?: number | undefined;
}

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const PreviewArt = ({
  cells,
  current,
}: MenuPreviewState & { readonly cells: number | undefined }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<PixelArt | undefined>(undefined);
  const icons = useRef(new Map<string, PixelIcon>());
  const shown = useRef<string | undefined>(undefined);

  useEffect(() => {
    // The pixels draw on the canvas; the idle sweep runs only while the open
    // menu shows the card.
    const start = (element: HTMLCanvasElement) => {
      const style = getComputedStyle(element);
      const tone = (name: string) => style.getPropertyValue(name).trim();

      const made = createPixelArt(element, {
        tones: [tone("--brand"), tone("--lavender"), "#ffffff", tone("--sun")],
      });

      art.current = made;

      const visibility = new IntersectionObserver((entries) => {
        const entry = entries.at(-1);
        made.idle(entry?.isIntersecting === true && !reducedMotion());
      });

      visibility.observe(element);

      return () => {
        visibility.disconnect();
        made.dispose();
        art.current = undefined;
      };
    };

    return canvas.current === null ? undefined : start(canvas.current);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const panel = element?.closest('[data-slot="menu-preview"]');
    const key = current ?? "";
    let cancelled = false;

    const source =
      current === null
        ? panel?.querySelector("[data-preview-art] svg")
        : panel?.querySelector(
            `[data-preview-key="${CSS.escape(current)}"] svg`
          );

    const show = async (svg: SVGSVGElement) => {
      const icon =
        icons.current.get(key) ??
        (await rasterise(svg, current === null ? cells : undefined));

      icons.current.set(key, icon);

      if (!cancelled && shown.current !== key) {
        art.current?.show(
          icon,
          shown.current !== undefined && !reducedMotion()
        );
        shown.current = key;
      }
    };

    if (source instanceof SVGSVGElement) {
      void show(source);
    }

    return () => {
      cancelled = true;
    };
  }, [cells, current]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="absolute inset-0 size-full [image-rendering:pixelated]"
    />
  );
};

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
 * and show the card's own art and intro otherwise. Such a card is not a
 * link and screen readers skip it: the rows are the links. Rows name
 * themselves with `data-preview-key`, and their icon's SVG is the art.
 * A fixed card, with no rows to follow (`items` empty), says what the rows
 * do not: screen readers read it, its art aside, and it may hold one
 * `link` under its intro.
 */
const MenuPreview = ({
  children,
  className,
  fallback,
  items,
  link,
}: {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  readonly fallback: MenuPreviewFallback;
  readonly items: readonly MenuPreviewItem[];
  /** A fixed card's one link, under its intro. */
  readonly link?: React.ReactNode;
}) => (
  <Root className={cn("flex gap-2", className)}>
    {({ current }: MenuPreviewState) => {
      const item = items.find((candidate) => candidate.key === current);

      return (
        <>
          {children}
          <div
            aria-hidden={items.length === 0 ? undefined : "true"}
            data-slot="menu-preview-card"
            className="bg-muted flex w-72 flex-col gap-3 rounded-md border p-2"
          >
            <BrandField rails={false} className="min-h-56 flex-1 rounded-md">
              <PreviewArt
                cells={fallback.cells}
                current={item === undefined ? null : current}
              />
            </BrandField>
            <span hidden data-preview-art="">
              {fallback.art}
            </span>
            <span className="flex flex-col gap-2 px-2 pb-2">
              <span className="grid">
                <Intro intro={fallback} shown={item === undefined} />
                {items.map((candidate) => (
                  <Intro
                    key={candidate.key}
                    intro={candidate}
                    shown={candidate === item}
                  />
                ))}
              </span>
              {items.length === 0 ? link : undefined}
            </span>
          </div>
        </>
      );
    }}
  </Root>
);

export { MenuPreview };

export type { MenuPreviewFallback, MenuPreviewIntro, MenuPreviewItem };
