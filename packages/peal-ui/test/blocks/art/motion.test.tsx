// @vitest-environment jsdom
// Art moves only on screen, and never for a reader who asked for less
// motion (DESIGN.md, Pixel art): each moving block marks its canvas
// `data-moving` exactly when it runs. jsdom has no layout, observers or
// canvas, so they are stubbed: the art then draws nothing, and the test
// reads what it would do.
import { cleanup, render, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PixelCube } from "../../../src/blocks/art/pixel-cube";
import { PixelField } from "../../../src/blocks/art/pixel-field";
import { PixelIcon } from "../../../src/blocks/art/pixel-icon";
import { intersectionObserverStub } from "./intersection-observer-stub";
import { ResizeObserverStub } from "./resize-observer-stub";

const stage = ({
  inView,
  reducedMotion,
}: {
  readonly inView: boolean;
  readonly reducedMotion: boolean;
}) => {
  vi.stubGlobal("IntersectionObserver", intersectionObserverStub(inView));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: () => null,
    matches: query.includes("reduce") && reducedMotion,
    removeEventListener: () => null,
  }));
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const moving: readonly [string, () => React.ReactElement][] = [
  ["the pixel icon", () => <PixelIcon animate icon="calendar" />],
  ["the pixel field", () => <PixelField />],
  ["the pixel cube", () => <PixelCube />],
];

describe("moving art", () => {
  it.each(moving)("%s moves on screen", async (_name, art) => {
    stage({ inView: true, reducedMotion: false });

    const { container } = render(art());

    await waitFor(() => {
      expect(container.querySelector("[data-in-view]")).not.toBeNull();
    });
    expect(container.querySelector("canvas[data-moving]")).not.toBeNull();
  });

  it.each(moving)("%s holds still off screen", async (_name, art) => {
    stage({ inView: false, reducedMotion: false });

    const { container } = render(art());

    await waitFor(() => {
      expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    });
    expect(container.querySelector("[data-in-view]")).toBeNull();
    expect(container.querySelector("canvas[data-moving]")).toBeNull();
  });

  it.each(moving)(
    "%s holds still for reduced motion, even on screen",
    async (_name, art) => {
      stage({ inView: true, reducedMotion: true });

      const { container } = render(art());

      await waitFor(() => {
        expect(container.querySelector("[data-in-view]")).not.toBeNull();
      });
      expect(container.querySelector("[data-reduced-motion]")).not.toBeNull();
      expect(container.querySelector("canvas[data-moving]")).toBeNull();
    }
  );

  it("an icon not asked to move holds still on screen", async () => {
    stage({ inView: true, reducedMotion: false });

    const { container } = render(<PixelIcon icon="calendar" />);

    await waitFor(() => {
      expect(container.querySelector("[data-in-view]")).not.toBeNull();
    });
    expect(container.querySelector("canvas[data-moving]")).toBeNull();
  });
});
