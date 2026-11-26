import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";

import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import { articleMarkdown } from "#shared/domain/rich-text/rich-body-markdown.ts";
import { ArticleBodySchema } from "#shared/domain/rich-text/rich-body.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

const decode = Schema.decodeUnknownOption(ArticleBodySchema);

const imageId = MediaAssetIdSchema.make("0199a000-0000-7000-8000-000000000a01");

type Written = typeof Schema.Json.Type;

const body = (...content: Written[]): ArticleBody => {
  const decoded = decode({ content, type: "doc" });

  if (Option.isNone(decoded)) {
    throw new Error("The test's document does not decode");
  }

  return decoded.value;
};

const text = (value: string, marks?: Written) =>
  marks === undefined
    ? { text: value, type: "text" }
    : { marks, text: value, type: "text" };

const paragraph = (...content: Written[]) => ({ content, type: "paragraph" });

const none = new Map();

describe("an article's body as Markdown", () => {
  it("writes headings, paragraphs, lists, quotes, code and rules", () => {
    const written = articleMarkdown(
      body(
        { attrs: { level: 2 }, content: [text("Sow early")], type: "heading" },
        paragraph(text("Peas first.")),
        {
          content: [
            { content: [paragraph(text("one"))], type: "listItem" },
            { content: [paragraph(text("two"))], type: "listItem" },
          ],
          type: "bulletList",
        },
        {
          attrs: { start: 3 },
          content: [{ content: [paragraph(text("three"))], type: "listItem" }],
          type: "orderedList",
        },
        { content: [paragraph(text("quoted"))], type: "blockquote" },
        { content: [text("let a = `b`;")], type: "codeBlock" },
        { type: "horizontalRule" }
      ),
      none
    );

    expect(written).toBe(
      [
        "## Sow early",
        "Peas first\\.",
        "- one\n- two",
        "3. three",
        "> quoted",
        "```\nlet a = `b`;\n```",
        "***",
      ].join("\n\n")
    );
  });

  it("numbers an ordered list from its start", () => {
    const written = articleMarkdown(
      body({
        content: [
          { content: [paragraph(text("a"))], type: "listItem" },
          { content: [paragraph(text("b"))], type: "listItem" },
        ],
        type: "orderedList",
      }),
      none
    );

    expect(written).toBe("1. a\n2. b");
  });

  it("writes marks and links, the spaces at their edges outside", () => {
    const written = articleMarkdown(
      body(
        paragraph(
          text("plain "),
          text("bold ", [{ type: "bold" }]),
          text("both", [{ type: "bold" }, { type: "italic" }]),
          text(" gone", [{ type: "strike" }]),
          text(" "),
          text("x()", [{ type: "code" }]),
          text(" "),
          text("site", [
            { attrs: { href: "https://example.com/a b(c)" }, type: "link" },
          ])
        )
      ),
      none
    );

    expect(written).toBe(
      "plain **bold *both*** ~~gone~~ `x()` [site](https://example.com/a%20b%28c%29)"
    );
  });

  it("keeps a member's text as text: no markup, no HTML, no template tag, no embed", () => {
    const written = articleMarkdown(
      body(
        paragraph(text("# not a heading")),
        paragraph(
          text(
            "<script>alert(1)</script> & {% embed x %} {{ y }} %[https://e.example] *a* _b_ [c](d) ![e](f) | ~g~"
          )
        ),
        paragraph(text("1. not a list")),
        paragraph(text("- not an item"))
      ),
      none
    );

    expect(written).toBe(
      [
        "\\# not a heading",
        "&lt;script&gt;alert\\(1\\)&lt;/script&gt; &amp; &#123;% embed x %&#125; &#123;&#123; y &#125;&#125; %\\[https://e\\.example\\] \\*a\\* \\_b\\_ \\[c\\]\\(d\\) \\!\\[e\\]\\(f\\) \\| \\~g\\~",
        "1\\. not a list",
        "\\- not an item",
      ].join("\n\n")
    );
  });

  it("fences code longer than any run of backticks it holds", () => {
    const written = articleMarkdown(
      body(
        { content: [text("```\nfenced")], type: "codeBlock" },
        paragraph(text("a ``b`` c", [{ type: "code" }]))
      ),
      none
    );

    expect(written).toBe("````\n```\nfenced\n````\n\n``` a ``b`` c ```");
  });

  it("shows images at the addresses the site gave, and leaves out the others", () => {
    const written = articleMarkdown(
      body(
        { attrs: { alt: "A [row] of peas", mediaId: imageId }, type: "image" },
        {
          attrs: {
            alt: "missing",
            mediaId: "0199a000-0000-7000-8000-000000000a02",
          },
          type: "image",
        }
      ),
      new Map([[imageId, "https://media.example/peas (1).png"]])
    );

    expect(written).toBe(
      "![A \\[row\\] of peas](https://media.example/peas%20%281%29.png)"
    );
  });

  it("breaks a line where the editor did, and nests lists under their item", () => {
    const written = articleMarkdown(
      body(paragraph(text("one"), { type: "hardBreak" }, text("two")), {
        content: [
          {
            content: [
              paragraph(text("outer")),
              {
                content: [
                  { content: [paragraph(text("inner"))], type: "listItem" },
                ],
                type: "bulletList",
              },
            ],
            type: "listItem",
          },
        ],
        type: "bulletList",
      }),
      none
    );

    expect(written).toBe("one\\\ntwo\n\n- outer\n\n  - inner");
  });
});

const forem = (...content: Written[]) =>
  articleMarkdown(body(...content), none, "forem");

describe("an article's body as DEV's Markdown", () => {
  it("writes each brace a member typed as Liquid's own text, never a tag", () => {
    expect(
      forem(paragraph(text("a {{ b }} {% embed https://e.example %} c")))
    ).toBe(
      "a {{ '{' }}{{ '{' }} b }} {{ '{' }}% embed https\\://e\\.example %} c"
    );
  });

  it("leaves a dollar alone, and breaks a line with two spaces", () => {
    expect(
      forem(paragraph(text("It costs $5"), { type: "hardBreak" }, text("then")))
    ).toBe("It costs $5  \nthen");
  });

  it("links no address: its colon is escaped, before Redcarpet's autolink", () => {
    expect(forem(paragraph(text("see https://example.com/a_b")))).toBe(
      "see https\\://example\\.com/a\\_b"
    );
  });

  it("writes a member's backtick as an entity, which Forem's code pass skips", () => {
    expect(forem(paragraph(text("a `{ b }` c")))).toBe(
      "a &#96;{{ '{' }} b }&#96; c"
    );
  });

  it("mentions nobody: an at sign is followed by a word joiner", () => {
    expect(forem(paragraph(text("thanks @ben and a@b")))).toBe(
      "thanks @\u2060ben and a&#64;b"
    );
  });
});

describe("Markdown that would show its syntax", () => {
  it("starts no code block from the spaces a paragraph begins with", () => {
    expect(articleMarkdown(body(paragraph(text("    indented"))), none)).toBe(
      "indented"
    );
  });

  it("closes a mark that ends in punctuation before a letter, as HTML", () => {
    expect(
      articleMarkdown(
        body(paragraph(text("Note:", [{ type: "bold" }]), text("text"))),
        none
      )
    ).toBe("<strong>Note:</strong>text");
  });

  it("keeps two lists in a row apart", () => {
    const list = {
      content: [{ content: [paragraph(text("one"))], type: "listItem" }],
      type: "bulletList",
    };

    expect(articleMarkdown(body(list, list), none)).toBe(
      "- one\n\n<!-- -->\n\n- one"
    );
  });
});

describe("a code block's language in Markdown", () => {
  const fenced = body(
    {
      attrs: { language: "c++" },
      content: [text("int main() { return 0; }")],
      type: "codeBlock",
    },
    { attrs: { language: null }, content: [text("plain")], type: "codeBlock" }
  );

  it("is the fence's info, in both dialects, and none without one", () => {
    const expected = "```c++\nint main() { return 0; }\n```\n\n```\nplain\n```";

    expect(articleMarkdown(fenced, none)).toBe(expected);
    expect(articleMarkdown(fenced, none, "forem")).toBe(expected);
  });
});
