import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandField } from "../../../src/blocks/art/brand-field";
import { BrandField as FieldComponent } from "../../../src/components/brand-field";

describe("BrandField among the art blocks", () => {
  it("is the brand field itself", () => {
    expect(BrandField).toBe(FieldComponent);
  });

  it("draws its rails with a tick at each joint, in the field's white", () => {
    const markup = renderToStaticMarkup(
      <BrandField captions={{ end: "end", start: "start" }}>
        <p>Content</p>
      </BrandField>
    );

    expect(markup.match(/data-on="field"/gu)).toHaveLength(4);
    expect(markup).toContain("bg-(--field-tick)");
    expect(markup).toContain("<p>Content</p>");
    expect(markup).toContain(">start</span>");
  });
});
