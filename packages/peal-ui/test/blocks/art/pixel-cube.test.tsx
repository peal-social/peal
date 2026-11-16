import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelCube } from "../../../src/blocks/art/pixel-cube";
import { AsciiArt } from "../../../src/components/ascii-art";

describe("PixelCube", () => {
  it("is a hidden canvas on the art stage, in pixels by default", () => {
    const markup = renderToStaticMarkup(<PixelCube className="h-80" />);

    expect(markup).toMatch(/^<div [^>]*aria-hidden="true"/u);
    expect(markup).toContain('data-art="pixel-cube"');
    expect(markup).toContain('data-variant="pixels"');
    expect(markup).toContain("<canvas");
    expect(markup).not.toContain("data-moving");
  });

  it("draws glyphs when asked", () => {
    expect(renderToStaticMarkup(<PixelCube variant="glyphs" />)).toContain(
      'data-variant="glyphs"'
    );
  });

  it("is still the hero art at its old path", () => {
    expect(AsciiArt).toBe(PixelCube);
  });
});
