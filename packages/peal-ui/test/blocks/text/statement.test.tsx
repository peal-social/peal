import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Statement } from "../../../src/blocks/text/statement";

describe("Statement", () => {
  it("leads in ink and continues in muted text, in one paragraph", () => {
    const markup = renderToStaticMarkup(
      <Statement lead="A bold phrase." body="And the rest of it." />
    );

    expect(markup).toMatch(/^<p /u);
    expect(markup).toContain(
      '<strong class="text-foreground font-semibold">A bold phrase.</strong> <span class="text-muted-foreground">And the rest of it.</span>'
    );
  });
});
