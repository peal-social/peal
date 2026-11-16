import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Mark } from "../../../src/blocks/blueprint/mark";

describe("Mark", () => {
  it("draws a brand's path in currentColor, hidden from screen readers", () => {
    const markup = renderToStaticMarkup(
      <Mark mark={{ kind: "path", path: "M2 2h20v20H2z" }} />
    );

    expect(markup).toMatch(/^<svg [^>]*aria-hidden="true"/u);
    expect(markup).toContain('fill="currentColor"');
    expect(markup).toContain('<path d="M2 2h20v20H2z">');
  });

  it("letters a tile for a brand with no mark", () => {
    const markup = renderToStaticMarkup(
      <Mark mark={{ kind: "letters", letters: "Ex" }} />
    );

    expect(markup).toMatch(/^<span aria-hidden="true"/u);
    expect(markup).toContain(">Ex</span>");
    expect(markup).toContain("bg-foreground");
  });
});
