import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CornerFrame } from "../../../src/blocks/blueprint/corner-frame";

describe("CornerFrame", () => {
  it("frames its content with a tick on each corner", () => {
    const markup = renderToStaticMarkup(
      <CornerFrame>
        <img src="/art.png" alt="A synthetic figure" />
      </CornerFrame>
    );

    expect(markup).toContain("border");
    expect(markup.match(/data-slot="tick"/gu)).toHaveLength(4);
    expect(markup).toContain('alt="A synthetic figure"');
  });
});
