import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkTile } from "../../../src/blocks/blueprint/mark-tile";

describe("MarkTile", () => {
  it("puts a lucide icon in a 32 px tile hidden from screen readers", () => {
    const markup = renderToStaticMarkup(<MarkTile icon="calendar" />);

    expect(markup).toMatch(/^<span aria-hidden="true"/u);
    expect(markup).toContain("size-8");
    expect(markup).toContain("lucide-calendar");
    expect(markup).not.toContain("role=");
  });

  it("names a brand's mark that stands alone, in a 40 px tile", () => {
    const markup = renderToStaticMarkup(
      <MarkTile
        label="Example"
        mark={{ kind: "path", path: "M2 2h20v20H2z" }}
        size={40}
      />
    );

    expect(markup).toContain('aria-label="Example"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain("size-10");
    expect(markup).toContain("size-5");
  });
});
