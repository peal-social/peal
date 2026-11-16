"use client";

import { definePrimitive } from "@ui-sdk/core";
import { createParts } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { cn } from "../../lib/utils";

/** What moving art needs to know to move, or to hold still. */
interface ArtStageState {
  readonly inView: boolean;
  readonly reducedMotion: boolean;
}

// The art's behaviour as a ui-sdk primitive: whether it is on screen, and
// whether the reader asked for less motion. ui-sdk keeps both private to
// its components, so the root's bind watches them itself.
const definition = definePrimitive({
  api: () => ({}),
  name: "art-stage",
  options: {},
  slots: (slot) => ({
    root: slot<object, ArtStageState>({
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
  state: (): ArtStageState => ({ inView: false, reducedMotion: false }),
});

// definePrimitive types `options` as possibly undefined, which ui-sdk's
// `Primitive` refuses under exactOptionalPropertyTypes; it has none.
const artStage = Object.assign(definition, { options: {} });

const { Root } = createParts(artStage, { root: "div" });

interface ArtStageProps {
  /** The art, drawn from whether it is on screen and may move. */
  readonly children: (state: ArtStageState) => React.ReactNode;
  readonly className?: string | undefined;
  /** What the art draws on, for its styles. */
  readonly "data-on"?: string | undefined;
  /** The art's own name, beside its `art-stage` slot. */
  readonly "data-art"?: string | undefined;
  /** Its variant, for its styles. */
  readonly "data-variant"?: string | undefined;
}

/**
 * The stage every moving piece of art stands on (DESIGN.md, Pixel art): it
 * tells the art whether it is on screen and whether the reader asked for
 * less motion, so art stops off screen and holds one still frame under
 * reduced motion. Decoration, hidden from screen readers.
 */
const ArtStage = ({
  children,
  className,
  "data-on": on,
  "data-art": art,
  "data-variant": variant,
}: ArtStageProps) => (
  <Root
    className={cn("relative", className)}
    data-on={on}
    data-art={art}
    data-variant={variant}
  >
    {children}
  </Root>
);

export { ArtStage };

export type { ArtStageProps, ArtStageState };
