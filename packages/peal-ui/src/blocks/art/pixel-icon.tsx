"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";

import { createPixelArt, rasterise } from "../../lib/pixel-icon";
import type {
  PixelArt,
  PixelIcon as PixelCoverage,
} from "../../lib/pixel-icon";
import { pixelTones } from "../../lib/pixel-palette";
import type { PixelGround } from "../../lib/pixel-palette";
import { siteIcons } from "../../lib/site-icons";
import type { SiteIcon } from "../../lib/site-icons";
import { cn } from "../../lib/utils";
import { Mark } from "../blueprint/mark";
import type { SiteMark } from "../blueprint/mark";
import { ArtStage } from "./art-stage";
import type { ArtStageState } from "./art-stage";

// The cells across a drawing's square: 34 for an icon, as the menus'
// previews draw it, or 48 for a larger drawing. The plain drawing the
// server serves takes the same size, 5 px a cell, written out whole so
// Tailwind finds it.
const drawingSizes = {
  34: "size-[170px]",
  48: "size-[240px]",
} as const;

type DrawingCells = keyof typeof drawingSizes;

interface IconCanvasProps extends ArtStageState {
  readonly animate: boolean;
  readonly artKey: string;
  readonly cells: DrawingCells;
  readonly children: React.ReactNode;
  readonly on: PixelGround;
}

const IconCanvas = ({
  animate,
  artKey,
  cells,
  children,
  inView,
  on,
  reducedMotion,
}: IconCanvasProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLSpanElement>(null);
  const art = useRef<PixelArt | undefined>(undefined);
  const drawings = useRef(new Map<string, PixelCoverage>());
  const shown = useRef<string | undefined>(undefined);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const start = (element: HTMLCanvasElement) => {
      const made = createPixelArt(element, {
        tones: pixelTones(element, on),
      });

      art.current = made;

      return () => {
        made.dispose();
        art.current = undefined;
        shown.current = undefined;
      };
    };

    return canvas.current === null ? undefined : start(canvas.current);
  }, [on]);

  // A new drawing dissolves in from the one shown, or appears at once
  // under reduced motion and the first time.
  useEffect(() => {
    const svg = source.current?.querySelector("svg");
    const key = `${artKey}/${cells}/${on}`;
    let cancelled = false;

    // A drawing the browser cannot decode leaves the plain icon showing.
    const show = async (drawing: SVGSVGElement) => {
      const coverage =
        drawings.current.get(key) ??
        (await rasterise(drawing, cells).catch(() => null));

      if (coverage === null) {
        return;
      }

      drawings.current.set(key, coverage);

      if (!cancelled && art.current !== undefined && shown.current !== key) {
        art.current.show(
          coverage,
          animate && shown.current !== undefined && !reducedMotion
        );
        shown.current = key;
        setDrawn(true);
      }
    };

    if (svg instanceof SVGSVGElement) {
      void show(svg);
    }

    return () => {
      cancelled = true;
    };
  }, [animate, artKey, cells, on, reducedMotion]);

  const moving = animate && inView && !reducedMotion;

  useEffect(() => {
    art.current?.idle(moving);
  }, [moving]);

  return (
    <>
      <span
        ref={source}
        data-pixel-source=""
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          on === "field" ? "text-(--field-foreground)" : "text-brand",
          drawn ? "invisible" : undefined
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center [&>svg]:size-full",
            drawingSizes[cells]
          )}
        >
          {children}
        </span>
      </span>
      <canvas
        ref={canvas}
        data-moving={moving ? "" : undefined}
        className="absolute inset-0 size-full [image-rendering:pixelated]"
      />
    </>
  );
};

type PixelIconProps = {
  /** Whether the art moves: a dissolve between drawings, and a sweep. */
  readonly animate?: boolean | undefined;
  /** Cells across the drawing, for one larger than an icon. */
  readonly cells?: DrawingCells | undefined;
  readonly className?: string | undefined;
  /** On the brand field, in its white, or on the page. */
  readonly on?: PixelGround | undefined;
} & (
  | {
      /** A lucide icon by name, from lib/site-icons. */
      readonly icon: SiteIcon;
      readonly mark?: undefined;
      readonly children?: undefined;
      readonly artKey?: undefined;
    }
  | {
      readonly icon?: undefined;
      /** A brand's mark. */
      readonly mark: SiteMark;
      readonly children?: undefined;
      readonly artKey?: undefined;
    }
  | {
      readonly icon?: undefined;
      readonly mark?: undefined;
      /** An SVG to draw, in currentColor, for a picture of the app's own. */
      readonly children: React.ReactNode;
      /** Names the drawing, so a new one dissolves in from the last. */
      readonly artKey: string;
    }
);

/** What the art draws, and its name. */
interface Drawing {
  readonly key: string;
  readonly node: React.ReactNode;
}

const markKey = (mark: SiteMark) =>
  mark.kind === "path" ? `mark:${mark.path}` : `letters:${mark.letters}`;

const drawingOf = (
  props: Pick<PixelIconProps, "artKey" | "children" | "icon" | "mark">
): Drawing => {
  if (props.icon !== undefined) {
    const Icon = siteIcons[props.icon];

    return {
      key: `icon:${props.icon}`,
      node: <Icon aria-hidden="true" strokeWidth={1.75} />,
    };
  }

  if (props.mark !== undefined) {
    return { key: markKey(props.mark), node: <Mark mark={props.mark} /> };
  }

  return { key: props.artKey ?? "", node: props.children };
};

/**
 * An icon, a brand's mark or a drawing in pixel art (DESIGN.md, Pixel art):
 * rasterised onto 5 px cells in blue, lavender and white (the deep blue on
 * the page) by coverage, Bayer-dithered and brighter toward the top, with
 * yellow on the top rows. The plain icon is the server's HTML, until the
 * pixels draw over it. With `animate`, a new drawing dissolves in and a
 * scanline sweeps while on screen; under reduced motion it holds still.
 * Decoration, hidden from screen readers; size it with `className`.
 */
const PixelIcon = ({
  animate = false,
  cells = 34,
  className,
  on = "page",
  ...props
}: PixelIconProps) => {
  const drawing = drawingOf(props);

  return (
    <ArtStage
      data-art="pixel-icon"
      data-on={on}
      className={cn("relative min-h-24 overflow-hidden", className)}
    >
      {(state) => (
        <IconCanvas
          {...state}
          animate={animate}
          artKey={drawing.key}
          cells={cells}
          on={on}
        >
          {drawing.node}
        </IconCanvas>
      )}
    </ArtStage>
  );
};

export { PixelIcon };

export type { PixelIconProps };
