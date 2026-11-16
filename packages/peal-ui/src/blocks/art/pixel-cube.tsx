"use client";

import { useEffect, useRef, useState } from "react";

import type { AsciiCube, AsciiCubeVariant } from "../../lib/ascii-cube";
import { cn } from "../../lib/utils";
import { ArtStage } from "./art-stage";
import type { ArtStageState } from "./art-stage";

const loadCube = async () => await import("../../lib/ascii-cube");

// Three.js and GSAP load once the art is on the page, after Geist Mono;
// without WebGL the art stays empty, which is still decoration.
const startCube = async (
  target: HTMLCanvasElement,
  variant: AsciiCubeVariant
): Promise<AsciiCube | undefined> => {
  try {
    const style = getComputedStyle(target);
    const { fontFamily } = style;

    const [{ createAsciiCube }] = await Promise.all([
      loadCube(),
      document.fonts.load(`14px ${fontFamily}`),
    ]);

    return createAsciiCube({
      canvas: target,
      colours: {
        left: style.getPropertyValue("--brand").trim(),
        right: style.getPropertyValue("--lavender").trim(),
        top: style.getPropertyValue("--sun").trim(),
      },
      fontFamily,
      scrollTarget: target.parentElement ?? target,
      variant,
    });
  } catch {
    return undefined;
  }
};

const CubeCanvas = ({
  inView,
  reducedMotion,
  variant,
}: ArtStageState & { readonly variant: AsciiCubeVariant }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cube, setCube] = useState<AsciiCube | undefined>();

  useEffect(() => {
    const element = canvas.current;
    let made: AsciiCube | undefined;
    let cancelled = false;

    const start = async (target: HTMLCanvasElement) => {
      const started = await startCube(target, variant);

      if (cancelled) {
        started?.dispose();
      } else {
        made = started;
        setCube(started);
      }
    };

    if (element !== null) {
      void start(element);
    }

    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [variant]);

  useEffect(() => {
    if (cube === undefined) {
      return;
    }

    if (reducedMotion) {
      cube.still();
    } else if (inView) {
      cube.play();
    } else {
      cube.pause();
    }
  }, [cube, inView, reducedMotion]);

  return (
    <canvas
      ref={canvas}
      data-moving={inView && !reducedMotion ? "" : undefined}
      className="absolute inset-0 size-full font-mono [image-rendering:pixelated]"
    />
  );
};

/**
 * Peal's cube in pixel art (DESIGN.md, Site, Hero art): dithered pixels or
 * small glyphs, turning slowly while on screen and still for reduced
 * motion. Decoration, hidden from screen readers; size it with `className`.
 */
const PixelCube = ({
  className,
  variant = "pixels",
}: {
  readonly className?: string | undefined;
  /** Square pixels with ordered dithering, or Geist Mono glyphs. */
  readonly variant?: AsciiCubeVariant | undefined;
}) => (
  <ArtStage
    data-art="pixel-cube"
    data-variant={variant}
    className={cn("relative", className)}
  >
    {(state) => <CubeCanvas {...state} variant={variant} />}
  </ArtStage>
);

export { PixelCube };
