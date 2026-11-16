import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionLabel } from "../../../src/blocks/text/section-label";

const text = (markup: string) => markup.replaceAll(/<[^>]+>/gu, "");

describe("SectionLabel", () => {
  it("puts its word in brackets, as a caption", () => {
    const markup = renderToStaticMarkup(<SectionLabel text="features" />);

    expect(markup).toMatch(/^<p /u);
    expect(text(markup)).toBe("[ features ]");
    expect(markup).toContain("font-mono");
    expect(markup).not.toContain("<a ");
  });

  it("gives its place on the page in two digits", () => {
    const markup = renderToStaticMarkup(
      <SectionLabel index={2} of={6} text="features" />
    );

    expect(text(markup)).toBe("[ 02 / 06 · features ]");
    expect(markup).toContain("tabular-nums");
  });

  it("hides the brackets from screen readers", () => {
    expect(
      renderToStaticMarkup(<SectionLabel text="features" />).match(
        /aria-hidden="true"/gu
      )
    ).toHaveLength(2);
  });
});
