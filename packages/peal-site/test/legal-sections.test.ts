import { describe, expect, it } from "vitest";

import { legalLayout } from "../src/legal-sections.ts";

const aside = "<aside>\n<p><strong>What it means</strong></p>\n</aside>";

describe("a legal document's layout", () => {
  it("cuts the document at each section and sets its plain lines apart", () => {
    const { preamble, sections } = legalLayout(
      [
        "<p>Effective date</p>",
        '<h2 id="summary">Summary</h2><p>Short.</p>',
        `<h2 id="one">One</h2><p>Text.</p>\n${aside}`,
        `<h2 id="two">Two</h2><table></table>${aside}`,
        '<h2 id="contact">Contact</h2><p>An address.</p>',
      ].join("\n")
    );

    expect(preamble.trim()).toBe("<p>Effective date</p>");
    expect(sections.map(({ kind }) => kind)).toStrictEqual([
      "opening",
      "paired",
      "stacked",
      "plain",
    ]);
    expect(sections[1]).toStrictEqual({
      aside,
      kind: "paired",
      text: '<h2 id="one">One</h2><p>Text.</p>',
    });
  });

  it("numbers the first section of a document without plain lines", () => {
    const { sections } = legalLayout(
      '<h2 id="one">One</h2><p>Text.</p><h2 id="two">Two</h2><p>Text.</p>'
    );

    expect(sections.map(({ kind }) => kind)).toStrictEqual(["plain", "plain"]);
  });
});
