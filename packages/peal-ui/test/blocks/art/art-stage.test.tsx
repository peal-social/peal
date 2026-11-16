import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArtStage } from "../../../src/blocks/art/art-stage";

describe("ArtStage", () => {
  it("is hidden decoration, off screen and moving until it reads both", () => {
    const markup = renderToStaticMarkup(
      <ArtStage className="h-40">
        {(state) => (
          <span
            data-state={`${String(state.inView)}/${String(state.reducedMotion)}`}
          />
        )}
      </ArtStage>
    );

    expect(markup).toMatch(/^<div [^>]*aria-hidden="true"/u);
    expect(markup).toContain('data-slot="art-stage"');
    expect(markup).toContain('data-state="false/false"');
    expect(markup).not.toContain("data-in-view");
    expect(markup).toContain("h-40");
  });

  it("takes the art's own name", () => {
    expect(
      renderToStaticMarkup(
        <ArtStage data-art="pixel-field">{() => null}</ArtStage>
      )
    ).toContain('data-art="pixel-field"');
  });
});
