import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionHeading } from "../../../src/blocks/text/section-heading";

describe("SectionHeading", () => {
  it("renders one h2 with its muted second sentence, the label and the lead", () => {
    const markup = renderToStaticMarkup(
      <SectionHeading
        headingId="features-title"
        heading={{
          label: { text: "features" },
          lead: "A synthetic lead.",
          title: "One title.",
          titleMuted: "A muted sentence.",
        }}
      />
    );

    expect(markup.match(/<h[1-6]/gu)).toStrictEqual(["<h2"]);
    expect(markup).toContain('<h2 id="features-title"');
    expect(markup).toContain(
      'One title. <span class="text-muted-foreground">A muted sentence.</span>'
    );
    expect(markup).toContain(">A synthetic lead.</p>");
    expect(markup).toContain('data-slot="section-label"');
  });

  it("renders an h3 when asked", () => {
    const markup = renderToStaticMarkup(
      <SectionHeading heading={{ level: 3, title: "One title." }} />
    );

    expect(markup.match(/<h[1-6]/gu)).toStrictEqual(["<h3"]);
    expect(markup).not.toContain("<p");
  });
});
