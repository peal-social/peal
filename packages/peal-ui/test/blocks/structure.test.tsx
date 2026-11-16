// @vitest-environment jsdom
// Structure: axe-core over each block's server markup, for names, lists,
// tables, landmarks and ARIA. jsdom cannot see colour, so contrast is left
// to DESIGN.md's pairs and a real browser.
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { specimens } from "./specimens";

const violations = async (markup: string) => {
  const container = document.createElement("main");
  container.innerHTML = markup;
  document.body.append(container);

  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
  });

  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`
  );
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("the blocks' structure", () => {
  // One run per block, its specimens side by side: axe runs one at a time.
  it.each([...specimens.keys()])("%s passes axe", async (slug) => {
    const markup = (specimens.get(slug) ?? [])
      .map((specimen) => renderToStaticMarkup(specimen()))
      .join("");

    expect(await violations(markup)).toStrictEqual([]);
  });

  it("finds a violation", async () => {
    expect(await violations("<button></button>")).not.toStrictEqual([]);
  });
});
