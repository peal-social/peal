import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Tick } from "../../../src/blocks/blueprint/tick";

describe("Tick", () => {
  it("is hidden decoration in input on the page", () => {
    const markup = renderToStaticMarkup(<Tick className="start-0" />);

    expect(markup).toMatch(/^<span aria-hidden="true"/u);
    expect(markup).toContain("bg-input");
    expect(markup).toContain("start-0");
  });

  it("takes the field's white on the brand field", () => {
    const markup = renderToStaticMarkup(<Tick on="field" />);

    expect(markup).toContain("bg-(--field-tick)");
    expect(markup).not.toContain("bg-input");
  });
});
