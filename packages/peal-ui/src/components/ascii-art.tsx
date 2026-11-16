"use client";

import { definePrimitive } from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";
import { useEffect, useRef, useState } from "react";

import type { AsciiCube, AsciiCubeVariant } from "../lib/ascii-cube";
import { cn } from "../lib/utils";

interface AsciiArtState {
  readonly inView: boolean;
  readonly reducedMotion: boolean;
}

// The art's behaviour as a ui-sdk primitive: whether it is on screen, and
// whether the reader asked for less motion. ui-sdk keeps both private to
// its components, so the root's bind watches them itself.
const definition = definePrimitive({
  api: () => ({}),
  name: "ascii-art",
  options: {},
  slots: (slot) => ({
    root: slot<object, AsciiArtState>({
      attrs: (state) => ({
        "aria-hidden": "true",
        "data-in-view": state.inView ? "" : undefined,
        "data-reduced-motion": state.reducedMotion ? "" : undefined,
      }),
      bind: (element, part) => {
        const visibility = new IntersectionObserver((entries) => {
          const entry = entries.at(-1);

          if (entry !== undefined) {
            part.store.set({ inView: entry.isIntersecting });
          }
        });

        visibility.observe(element);

        const motion = matchMedia("(prefers-reduced-motion: reduce)");

        const readMotion = () => {
          part.store.set({ reducedMotion: motion.matches });
        };

        readMotion();
        motion.addEventListener("change", readMotion);

        return () => {
          visibility.disconnect();
          motion.removeEventListener("change", readMotion);
        };
      },
      state: (state) => ({
        inView: state.inView,
        reducedMotion: state.reducedMotion,
      }),
    }),
  }),
  state: (): AsciiArtState => ({ inView: false, reducedMotion: false }),
});

// definePrimitive types `options` as possibly undefined, which ui-sdk's
// `Primitive` refuses under exactOptionalPropertyTypes; it has none.
const asciiArt = Object.assign(definition, { options: {} });

const { Root } = createParts(asciiArt, { root: "div" });

const loadCube = async () => await import("../lib/ascii-cube");

const AsciiCanvas = ({
  inView,
  reducedMotion,
  variant,
}: AsciiArtState & { readonly variant: AsciiCubeVariant }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cube, setCube] = useState<AsciiCube | undefined>();

  // Three.js and GSAP load once the art is on the page, after Geist Mono.
  useEffect(() => {
    const element = canvas.current;
    let made: AsciiCube | undefined;
    let cancelled = false;

    const start = async (target: HTMLCanvasElement) => {
      const style = getComputedStyle(target);
      const { fontFamily } = style;

      const [{ createAsciiCube }] = await Promise.all([
        loadCube(),
        document.fonts.load(`14px ${fontFamily}`),
      ]);

      if (!cancelled) {
        made = createAsciiCube({
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
        setCube(made);
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
      className="absolute inset-0 size-full font-mono [image-rendering:pixelated]"
    />
  );
};

/**
 * The site's hero art (DESIGN.md, Site): Peal's cube as dithered pixels or
 * as small glyphs, turning slowly while on screen and still for reduced
 * motion. It is decoration, hidden from screen readers; size it with
 * `className`.
 */
const AsciiArt = ({
  className,
  variant = "pixels",
}: {
  readonly className?: string | undefined;
  /** Square pixels with ordered dithering, or Geist Mono glyphs. */
  readonly variant?: AsciiCubeVariant | undefined;
}) => (
  <Root
    data-slot="ascii-art"
    data-variant={variant}
    className={cn("relative", className)}
  >
    {(state: AsciiArtState) => <AsciiCanvas {...state} variant={variant} />}
  </Root>
);

export { AsciiArt };
