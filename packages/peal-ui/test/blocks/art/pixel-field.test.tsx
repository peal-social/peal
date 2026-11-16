import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelField } from "../../../src/blocks/art/pixel-field";

describe("PixelField", () => {
  it("is a hidden canvas on the art stage, still until it reads the page", () => {
    const markup = renderToStaticMarkup(<PixelField className="h-64" />);

    expect(markup).toMatch(/^<div [^>]*aria-hidden="true"/u);
    expect(markup).toContain('data-art="pixel-field"');
    expect(markup).toContain("h-64");
    expect(markup).toContain("<canvas");
    expect(markup).not.toContain("data-moving");
  });
});
