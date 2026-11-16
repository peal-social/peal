"use client";

import { useEffect, useRef, useState } from "react";

import { createPixelField } from "../../lib/pixel-field";
import type { PixelField as PixelFieldArt } from "../../lib/pixel-field";
import { pixelTones } from "../../lib/pixel-palette";
import { cn } from "../../lib/utils";
import { ArtStage } from "./art-stage";
import type { ArtStageState } from "./art-stage";

const FieldCanvas = ({
  inView,
  reducedMotion,
  seed,
}: ArtStageState & { readonly seed: number }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [field, setField] = useState<PixelFieldArt | undefined>();

  useEffect(() => {
    const start = (element: HTMLCanvasElement) => {
      const made = createPixelField(element, pixelTones(element, "page"), seed);

      setField(made);

      return () => {
        made?.dispose();
      };
    };

    return canvas.current === null ? undefined : start(canvas.current);
  }, [seed]);

  useEffect(() => {
    if (field === undefined) {
      return;
    }

    if (reducedMotion) {
      field.still();
    } else if (inView) {
      field.play();
    } else {
      field.pause();
    }
  }, [field, inView, reducedMotion]);

  return (
    <canvas
      ref={canvas}
      data-moving={inView && !reducedMotion ? "" : undefined}
      className="absolute inset-0 size-full [image-rendering:pixelated]"
    />
  );
};

/**
 * The pixel field (DESIGN.md, Pixel art): a slow noise in lavender, blue
 * and yellow on 5 px cells, for an art cell on `background`. It moves while
 * on screen and holds one frame under reduced motion; without WebGL2 it
 * stays empty. Decoration, hidden from screen readers; size it with
 * `className`.
 */
const PixelField = ({
  className,
  seed = 1,
}: {
  readonly className?: string | undefined;
  /** Picks the noise, so two fields on a page differ. */
  readonly seed?: number | undefined;
}) => (
  <ArtStage
    data-art="pixel-field"
    className={cn("relative min-h-24 overflow-hidden", className)}
  >
    {(state) => <FieldCanvas {...state} seed={seed} />}
  </ArtStage>
);

export { PixelField };
