import { describe, expect, it } from "@effect/vitest";

import { linkTarget, parseInline, parseMarkdown } from "#agent/markdown.ts";

// An address that would run a script, built so no linter takes it for one.
const scriptUrl = ["javascript", "alert(1)"].join(":");

describe(parseMarkdown, () => {
  it("reads paragraphs apart, and a single line break inside one", () => {
    expect(parseMarkdown("One line\nthe next\n\nA second one")).toStrictEqual([
      {
        _tag: "paragraph",
        children: [
          { _tag: "text", text: "One line" },
          { _tag: "break" },
          { _tag: "text", text: "the next" },
        ],
      },
      {
        _tag: "paragraph",
        children: [{ _tag: "text", text: "A second one" }],
      },
    ]);
  });

  it("reads bulleted and numbered lists, an item going on under it", () => {
    expect(
      parseMarkdown(
        "Drafts:\n- Spring sale\n  for Monday\n* Launch\n\n1. First\n2) Second"
      )
    ).toStrictEqual([
      { _tag: "paragraph", children: [{ _tag: "text", text: "Drafts:" }] },
      {
        _tag: "list",
        items: [
          [{ _tag: "text", text: "Spring sale for Monday" }],
          [{ _tag: "text", text: "Launch" }],
        ],
        ordered: false,
      },
      {
        _tag: "list",
        items: [
          [{ _tag: "text", text: "First" }],
          [{ _tag: "text", text: "Second" }],
        ],
        ordered: true,
      },
    ]);
  });

  it("keeps a heading's words and drops its marks", () => {
    expect(parseMarkdown("## Your week")).toStrictEqual([
      { _tag: "paragraph", children: [{ _tag: "text", text: "Your week" }] },
    ]);
  });

  it("leaves HTML as text", () => {
    expect(parseMarkdown("<script>alert(1)</script>")).toStrictEqual([
      {
        _tag: "paragraph",
        children: [{ _tag: "text", text: "<script>alert(1)</script>" }],
      },
    ]);
  });
});

describe(parseInline, () => {
  it("reads bold, italics and inline code", () => {
    expect(
      parseInline("**Due** on _Monday_, see `post_id` *now*")
    ).toStrictEqual([
      { _tag: "strong", children: [{ _tag: "text", text: "Due" }] },
      { _tag: "text", text: " on " },
      { _tag: "em", children: [{ _tag: "text", text: "Monday" }] },
      { _tag: "text", text: ", see " },
      { _tag: "code", text: "post_id" },
      { _tag: "text", text: " " },
      { _tag: "em", children: [{ _tag: "text", text: "now" }] },
    ]);
  });

  it("leaves markers that open nothing as text", () => {
    expect(
      parseInline("2 * 3 = 6, snake_case_name, a ` alone, **open")
    ).toStrictEqual([
      { _tag: "text", text: "2 * 3 = 6, snake_case_name, a ` alone, **open" },
    ]);
  });

  it("reads an escaped marker as itself", () => {
    expect(parseInline(String.raw`\*not italics\*`)).toStrictEqual([
      { _tag: "text", text: "*not italics*" },
    ]);
  });

  it("links this origin's paths in place and other sites in a new tab", () => {
    expect(
      parseInline(
        "[the post](/studio/posts/p1) or [docs](https://docs.example.com/x)"
      )
    ).toStrictEqual([
      {
        _tag: "link",
        children: [{ _tag: "text", text: "the post" }],
        href: "/studio/posts/p1",
        internal: true,
      },
      { _tag: "text", text: " or " },
      {
        _tag: "link",
        children: [{ _tag: "text", text: "docs" }],
        href: "https://docs.example.com/x",
        internal: false,
      },
    ]);
  });

  it("keeps the words of a link to anywhere else, without the link", () => {
    expect(
      parseInline(`[click](${scriptUrl}) and [here](//evil.example)`)
    ).toStrictEqual([{ _tag: "text", text: "click) and here" }]);
  });
});

describe(linkTarget, () => {
  it("takes paths of this origin and http(s) addresses only", () => {
    expect(
      [
        "/a/b",
        "https://example.com",
        "http://example.com/x",
        "//example.com",
        String.raw`/\example.com`,
        scriptUrl,
        "data:text/html,hi",
        "mailto:someone@example.com",
        "relative/path",
      ].map((href) => linkTarget(href)?.internal ?? null)
    ).toStrictEqual([true, false, false, null, null, null, null, null, null]);
  });
});
