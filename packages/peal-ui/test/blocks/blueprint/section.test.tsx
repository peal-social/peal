import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Section } from "../../../src/blocks/blueprint/section";

describe("Section", () => {
  it("is a region named by its heading, with a rule and two joints", () => {
    const markup = renderToStaticMarkup(
      <Section id="features" labelledBy="features-title">
        <h2 id="features-title">Features</h2>
      </Section>
    );

    expect(markup).toMatch(
      /^<section id="features" aria-labelledby="features-title"/u
    );
    expect(markup).toContain('data-rule="top"');
    expect(markup).toContain("border-t");
    expect(markup.match(/data-slot="tick"/gu)).toHaveLength(2);
    expect(markup).toContain('<h2 id="features-title">Features</h2>');
  });

  it("draws both rules, or none", () => {
    const both = renderToStaticMarkup(<Section rule="both" />);
    const none = renderToStaticMarkup(<Section rule="none" />);

    expect(both).toContain("border-b");
    expect(both.match(/data-slot="tick"/gu)).toHaveLength(4);
    expect(none).not.toContain("border-t");
    expect(none).not.toContain('data-slot="tick"');
  });

  it("renders the element it is given", () => {
    expect(renderToStaticMarkup(<Section render={<div />} />)).toMatch(
      /^<div /u
    );
  });
});
