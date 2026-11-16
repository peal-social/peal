import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Cell } from "../../../src/blocks/blueprint/cell";

describe("Cell", () => {
  it("is a bordered cell on background by default", () => {
    const markup = renderToStaticMarkup(<Cell>Content</Cell>);

    expect(markup).toContain("outline");
    expect(markup).toContain("bg-background");
    expect(markup).toContain(">Content</div>");
  });

  it.each([
    ["card", "bg-card"],
    ["muted", "bg-muted"],
  ] as const)("takes the %s surface", (surface, className) => {
    expect(renderToStaticMarkup(<Cell surface={surface} />)).toContain(
      className
    );
  });

  it("spans columns, at most two on a phone-wide tablet", () => {
    expect(renderToStaticMarkup(<Cell span={3} />)).toContain(
      "sm:col-span-2 lg:col-span-3"
    );
  });

  it("shows nothing when hatched, and is hidden from screen readers", () => {
    const markup = renderToStaticMarkup(<Cell surface="hatch">Content</Cell>);

    expect(markup).toContain("bg-(image:--hatch)");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("Content");
  });
});
