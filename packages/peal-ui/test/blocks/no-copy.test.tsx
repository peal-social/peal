// @vitest-environment jsdom
// No copy inside (the blocks' rule 2): every string a block shows or names
// itself with comes from its props. Each block renders with sentinels, and
// its server markup may hold no other text, no other accessible name and
// no other title, but the punctuation of a label and the digits of an
// index given as a number.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { blockSlugs } from "./block-files";
import { specimens } from "./specimens";

// What is left of a string once its sentinels and a label's punctuation and
// digits are taken out; empty when it holds no copy of the block's own.
const leftover = (text: string) =>
  text.replaceAll(/copy:[\w-]+/gu, "").replaceAll(/[\s[\]/·\d]/gu, "");

const namingAttributes = [
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "alt",
  "placeholder",
  "title",
];

const copyIn = (markup: string): readonly string[] => {
  const template = document.createElement("template");
  template.innerHTML = markup;

  const found: string[] = [];

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT
  );

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (leftover(node.textContent ?? "") !== "") {
      found.push(node.textContent ?? "");
    }
  }

  for (const element of template.content.querySelectorAll("*")) {
    for (const name of namingAttributes) {
      const value = element.getAttribute(name);

      if (value !== null && leftover(value) !== "") {
        found.push(`${name}="${value}"`);
      }
    }
  }

  return found;
};

describe("no copy inside a block", () => {
  it("finds the blocks", () => {
    expect(blockSlugs.length).toBeGreaterThan(0);
  });

  it.each(blockSlugs)("%s has specimens", (slug) => {
    expect(specimens.get(slug)?.length ?? 0).toBeGreaterThan(0);
  });

  it.each([...specimens.keys()])(
    "%s shows only the strings its props give",
    (slug) => {
      for (const specimen of specimens.get(slug) ?? []) {
        expect(copyIn(renderToStaticMarkup(specimen()))).toStrictEqual([]);
      }
    }
  );

  it("catches a string of a block's own", () => {
    expect(copyIn("<button aria-label='Close'>copy:x</button>")).toStrictEqual([
      'aria-label="Close"',
    ]);
    expect(copyIn("<p>[ 02 / 06 · copy:x ] More</p>")).toStrictEqual([
      "[ 02 / 06 · copy:x ] More",
    ]);
  });
});
