import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PixelIcon } from "../../../src/blocks/art/pixel-icon";

describe("PixelIcon", () => {
  it("serves the plain icon, hidden from screen readers, under its canvas", () => {
    const markup = renderToStaticMarkup(<PixelIcon icon="calendar" />);

    expect(markup).toMatch(/^<div [^>]*aria-hidden="true"/u);
    expect(markup).toContain('data-art="pixel-icon"');
    expect(markup).toContain('data-on="page"');
    expect(markup).toContain("lucide-calendar");
    expect(markup).toContain("text-brand");
    expect(markup).toContain("<canvas");
    expect(markup).toContain("size-[170px]");
  });

  it("draws a brand's mark in the field's white on the brand field", () => {
    const markup = renderToStaticMarkup(
      <PixelIcon mark={{ kind: "path", path: "M2 2h20v20H2z" }} on="field" />
    );

    expect(markup).toContain('<path d="M2 2h20v20H2z">');
    expect(markup).toContain("text-(--field-foreground)");
  });

  it("draws an SVG of the app's own, at the cells asked", () => {
    const markup = renderToStaticMarkup(
      <PixelIcon artKey="fan-out" cells={48}>
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="8" />
        </svg>
      </PixelIcon>
    );

    expect(markup).toContain('<circle cx="32" cy="32" r="8">');
    expect(markup).toContain("size-[240px]");
  });
});
