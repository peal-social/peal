"use client";

import { definePrimitive } from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type * as React from "react";

import { createPixelArt, rasterise } from "../lib/pixel-icon";
import type { PixelArt, PixelIcon } from "../lib/pixel-icon";
import { cn } from "../lib/utils";
import { BrandField } from "./brand-field";
import { NavigationMenuLink } from "./navigation-menu";

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

/** A row the preview can show, by the key its row carries. */
interface MenuPreviewItem {
  readonly description: string;
  readonly href: string;
  readonly key: string;
  readonly title: string;
}

/** What the card shows while no row is previewed. */
interface MenuPreviewFallback {
  /** Its art: an SVG, such as a brand's mark, which the card rasterises. */
  readonly art: React.ReactNode;
  readonly caption: string;
  readonly description: string;
  readonly href: string;
  readonly title: string;
}

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const PreviewArt = ({ current }: MenuPreviewState) => {
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
      const icon = icons.current.get(key) ?? (await rasterise(svg));
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
  }, [current]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="absolute inset-0 size-full [image-rendering:pixelated]"
    />
  );
};

/**
 * A mega menu's preview (DESIGN.md, Site): its rows, then a card whose
 * pixel art and caption follow the row the pointer rests on or focus is
 * in, and show the card's own content otherwise. Rows name themselves with
 * `data-preview-key`, and their icon's SVG is the art.
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
          <NavigationMenuLink
            href={item?.href ?? fallback.href}
            className="bg-muted hover:bg-accent group/feature w-72 flex-col gap-3 border p-2"
          >
            <BrandField rails={false} className="min-h-56 flex-1 rounded-md">
              <PreviewArt current={item === undefined ? null : current} />
            </BrandField>
            <span hidden data-preview-art="">
              {fallback.art}
            </span>
            <span className="flex flex-col gap-1 px-2 pb-2">
              <span className="text-muted-foreground font-mono text-xs tracking-[0.04em] lowercase">
                {fallback.caption}
              </span>
              <span className="text-foreground flex items-center gap-1.5 text-[15px] font-semibold">
                {item?.title ?? fallback.title}
                <ArrowRightIcon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 transition-transform group-hover/feature:translate-x-0.5 motion-reduce:transition-none"
                />
              </span>
              <span className="text-muted-foreground text-[13px] leading-snug">
                {item?.description ?? fallback.description}
              </span>
            </span>
          </NavigationMenuLink>
        </>
      );
    }}
  </Root>
);

export { MenuPreview };

export type { MenuPreviewFallback, MenuPreviewItem };
