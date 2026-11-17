// A code block as the server renders it: its island's props name the
// languages and carry no code, every language's lines come once, from the
// slots, and only the language showing gets a scroll area.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CodeBlock, codeBlockParts } from "../src/components/code-block.tsx";
import type {
  CodeBlockContent,
  CodeBlockSlots,
} from "../src/components/code-block.tsx";
import { CodeLines } from "../src/components/code-lines.tsx";
import { encodeHighlighted } from "../src/lib/highlighted-code";

const code = (text: string) =>
  encodeHighlighted([[{ kind: "keyword", text }], [{ text: "done()" }]]);

const content: CodeBlockContent = {
  copied: "Copied",
  copy: "Copy",
  label: "Language",
  lineNumbers: true,
  response: {
    filename: "201 Created",
    highlighted: code("response_body"),
    label: "JSON",
    mark: { kind: "path", path: "M0 0h24v24H0z" },
    value: "json",
  },
  samples: ["curl", "python", "go"].map((value) => ({
    filename: `${value}.txt`,
    highlighted: code(`${value}_request`),
    label: value,
    mark: { kind: "path", path: "M0 0h24v24H0z" },
    value,
  })),
};

const { panels, props, response } = codeBlockParts(content);

// The slots as the page fills them: CodeLines, rendered on the server.
const slots: CodeBlockSlots = {
  ...Object.fromEntries(
    panels.map(
      (panel) => [panel.slot, createElement(CodeLines, panel.lines)] as const
    )
  ),
  responseCode: createElement(
    CodeLines,
    response?.lines ?? { highlighted: "" }
  ),
};

const html = renderToString(createElement(CodeBlock, { ...props, ...slots }));

const panelTags = [
  ...html.matchAll(/<div(?<attributes>[^>]*role="tabpanel"[^>]*)>/gu),
].map((match) => match.groups?.["attributes"] ?? "");

describe("a code block", () => {
  it("keeps the code out of the island's props", () => {
    const serialized = JSON.stringify(props);

    expect(serialized).not.toContain("request");
    expect(serialized).not.toContain("response_body");
    expect(serialized).not.toContain("highlighted");
  });

  it("gives each language's lines their own slot, as tall as the longest", () => {
    expect(panels.map((panel) => panel.slot)).toStrictEqual([
      "panel0",
      "panel1",
      "panel2",
    ]);
    expect(panels.every((panel) => panel.lines.minLines === 2)).toBe(true);
  });

  it("renders each language's lines once, hiding all but the first", () => {
    for (const value of ["curl", "python", "go"]) {
      expect(html.split(`${value}_request`)).toHaveLength(2);
    }

    expect(panelTags).toHaveLength(3);
    expect(panelTags.map((tag) => / hidden=""/u.test(tag))).toStrictEqual([
      false,
      true,
      true,
    ]);
  });

  it("scrolls only the panes on screen", () => {
    // The request showing and the response: two scroll areas, not four.
    expect(html.split('data-slot="scroll-area"')).toHaveLength(3);
  });
});
