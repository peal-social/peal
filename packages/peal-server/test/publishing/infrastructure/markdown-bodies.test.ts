import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";

import type { BodyProblem } from "#publishing/domain/body-problem.ts";
import { readMarkdown } from "#publishing/infrastructure/markdown/mdast-markdown-bodies.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import { articleHtml } from "#shared/domain/rich-text/rich-body-html.ts";
import { articleMarkdown } from "#shared/domain/rich-text/rich-body-markdown.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

import { htmlOutline } from "./html-outline.ts";

const mediaId = "0199a000-0000-7000-8000-000000000a01";

const otherMediaId = "0199a000-0000-7000-8000-000000000a02";

// The body the Markdown reads as; the test fails on a refusal.
const bodyOf = (markdown: string): ArticleBody => {
  const result = readMarkdown(markdown);

  if (Result.isFailure(result)) {
    throw new Error(`Refused: ${JSON.stringify(result.failure)}`);
  }

  return result.success;
};

const read = (markdown: string): ArticleBody["content"] =>
  bodyOf(markdown).content;

// The problems the Markdown is refused for; the test fails if it reads.
const problemsOf = (markdown: string): readonly BodyProblem[] => {
  const result = readMarkdown(markdown);

  if (Result.isSuccess(result)) {
    throw new Error("The Markdown was read");
  }

  return result.failure;
};

const text = (value: string, marks?: readonly unknown[]) =>
  marks === undefined
    ? { text: value, type: "text" }
    : { marks, text: value, type: "text" };

const paragraph = (...content: unknown[]) => ({ content, type: "paragraph" });

const link = (href: string) => ({ attrs: { href }, type: "link" });

describe("a body sent as Markdown", () => {
  it("reads paragraphs, a soft line break as a space, and marks nested as written", () => {
    expect(
      read(
        "Sow *early*, **often**\nand ~~never~~ `late`.\n\n***Both*** at once"
      )
    ).toStrictEqual([
      paragraph(
        text("Sow "),
        text("early", [{ type: "italic" }]),
        text(", "),
        text("often", [{ type: "bold" }]),
        text(" and "),
        text("never", [{ type: "strike" }]),
        text(" "),
        text("late", [{ type: "code" }]),
        text(".")
      ),
      paragraph(
        text("Both", [{ type: "italic" }, { type: "bold" }]),
        text(" at once")
      ),
    ]);
  });

  it("breaks a line where two spaces, a backslash or <br> end it", () => {
    expect(read("one  \ntwo\\\nthree<br>four<br/>five")).toStrictEqual([
      paragraph(
        text("one"),
        { type: "hardBreak" },
        text("two"),
        { type: "hardBreak" },
        text("three"),
        { type: "hardBreak" },
        text("four"),
        { type: "hardBreak" },
        text("five")
      ),
    ]);
  });

  it("reads headings of levels 2 to 4, quotes and rules", () => {
    expect(
      read("## Two\n\n### Three\n\n#### Four\n\n> Quoted\n\n***")
    ).toStrictEqual([
      { attrs: { level: 2 }, content: [text("Two")], type: "heading" },
      { attrs: { level: 3 }, content: [text("Three")], type: "heading" },
      { attrs: { level: 4 }, content: [text("Four")], type: "heading" },
      { content: [paragraph(text("Quoted"))], type: "blockquote" },
      { type: "horizontalRule" },
    ]);
  });

  it("reads lists, nested, an ordered one from its start, a task item's box as its text", () => {
    expect(
      read("- [x] done\n- [ ] todo\n  1. inner\n\n3. three\n4. four")
    ).toStrictEqual([
      {
        content: [
          {
            content: [paragraph(text("[x] "), text("done"))],
            type: "listItem",
          },
          {
            content: [
              paragraph(text("[ ] "), text("todo")),
              {
                content: [
                  { content: [paragraph(text("inner"))], type: "listItem" },
                ],
                type: "orderedList",
              },
            ],
            type: "listItem",
          },
        ],
        type: "bulletList",
      },
      {
        attrs: { start: 3 },
        content: [
          { content: [paragraph(text("three"))], type: "listItem" },
          { content: [paragraph(text("four"))], type: "listItem" },
        ],
        type: "orderedList",
      },
    ]);
  });

  it("keeps a code block's language, and leaves out one that is no word of code", () => {
    expect(
      read(
        "```typescript\nconst a = 1;\n```\n\n```{.weird}\nx\n```\n\n    indented"
      )
    ).toStrictEqual([
      {
        attrs: { language: "typescript" },
        content: [text("const a = 1;")],
        type: "codeBlock",
      },
      { content: [text("x")], type: "codeBlock" },
      { content: [text("indented")], type: "codeBlock" },
    ]);
  });

  it("links an inline link, an autolink, a bare address and a reference, titles left out", () => {
    expect(
      read(
        '[inline](https://a.example "A title") <https://b.example> www.c.example [ref] <d@e.example>\n\n[ref]: https://r.example "Its title"'
      )
    ).toStrictEqual([
      paragraph(
        text("inline", [link("https://a.example")]),
        text(" "),
        text("https://b.example", [link("https://b.example")]),
        text(" "),
        text("www.c.example", [link("http://www.c.example")]),
        text(" "),
        text("ref", [link("https://r.example")]),
        text(" "),
        text("d@e.example", [link("mailto:d@e.example")])
      ),
    ]);
  });

  it("shows a library's file, cutting the paragraph around it", () => {
    expect(
      read(
        `Before ![A row of peas](media:${mediaId} "A title") after\n\n![](media:${otherMediaId})`
      )
    ).toStrictEqual([
      paragraph(text("Before ")),
      { attrs: { alt: "A row of peas", mediaId }, type: "image" },
      paragraph(text(" after")),
      { attrs: { alt: "", mediaId: otherMediaId }, type: "image" },
    ]);
  });

  it("leaves out an HTML comment, which nothing shows", () => {
    expect(read("<!-- a note -->\n\nKept <!-- inline --> text")).toStrictEqual([
      paragraph(text("Kept "), text(" text")),
    ]);
  });

  it("reads text that only looks like a reference as text, as CommonMark does", () => {
    expect(read("[not a link] and [x][y]")).toStrictEqual([
      paragraph(text("[not a link] and [x][y]")),
    ]);
  });

  it("reads nothing as an empty body", () => {
    expect(read("")).toStrictEqual([]);
  });
});

describe("a body sent as Markdown, refused", () => {
  it("names a heading of level 1, 5 or 6 by its place", () => {
    expect(
      problemsOf("# One\n\nText\n\n##### Five\n\n###### Six\n\nSetext\n===")
    ).toStrictEqual([
      { column: 1, line: 1, problem: "headingLevel" },
      { column: 1, line: 5, problem: "headingLevel" },
      { column: 1, line: 7, problem: "headingLevel" },
      { column: 1, line: 9, problem: "headingLevel" },
    ]);
  });

  it("refuses raw HTML, a script and an image's handler among it", () => {
    expect(
      problemsOf(
        "<div>block</div>\n\nA <script>alert(1)</script> and <img src=x onerror=alert(1)>"
      )
    ).toStrictEqual([
      { column: 1, line: 1, problem: "html" },
      { column: 3, line: 3, problem: "html" },
      { column: 19, line: 3, problem: "html" },
      { column: 33, line: 3, problem: "html" },
    ]);
  });

  it("refuses a table and a footnote", () => {
    expect(
      problemsOf(
        "| a | b |\n| - | - |\n| 1 | 2 |\n\nNoted[^1]\n\n[^1]: The note"
      )
    ).toStrictEqual([
      { column: 1, line: 1, problem: "table" },
      { column: 6, line: 5, problem: "footnote" },
      { column: 1, line: 7, problem: "footnote" },
    ]);
  });

  it("refuses front matter: the title and the tags are the channel's options", () => {
    expect(
      problemsOf("---\ntitle: Sow early\ntags: [garden]\n---\n\nBody")
    ).toStrictEqual([{ column: 1, line: 1, problem: "frontMatter" }]);
  });

  it("refuses an image at an address, of no media id, in a heading or in a link", () => {
    expect(
      problemsOf(
        [
          "![x](https://img.example/a.png)",
          "![x](media:not-an-id)",
          `## A ![x](media:${mediaId}) heading`,
          `[![x](media:${mediaId})](https://a.example)`,
        ].join("\n\n")
      )
    ).toStrictEqual([
      { column: 1, line: 1, problem: "image" },
      { column: 1, line: 3, problem: "image" },
      { column: 6, line: 5, problem: "image" },
      { column: 2, line: 7, problem: "image" },
    ]);
  });

  it("refuses a link to a script, a document of its own, another scheme or a relative address", () => {
    expect(
      problemsOf(
        [
          `[a](${["javascript", "alert(1)"].join(":")})`,
          "[b](data:text/html,hi)",
          "[c](ftp://files.example)",
          "[d](/relative)",
          `[e](https://long.example/${"a".repeat(2048)})`,
        ].join("\n\n")
      )
    ).toStrictEqual(
      [1, 3, 5, 7, 9].map((line) => ({ column: 1, line, problem: "link" }))
    );
  });

  it("answers at most 20 problems", () => {
    expect(problemsOf("# One\n\n".repeat(30))).toHaveLength(20);
  });

  it("refuses a body past its bounds: too deep, too many files, too long", () => {
    expect(problemsOf(`${"> ".repeat(9)}deep`)).toStrictEqual([
      { column: 17, line: 1, problem: "tooLarge" },
    ]);

    const files = Array.from(
      { length: 101 },
      (_, index) =>
        `![](media:0199a000-0000-7000-8000-${String(index).padStart(12, "0")})`
    ).join("\n\n");

    expect(problemsOf(files)).toStrictEqual([{ problem: "tooLarge" }]);
    expect(problemsOf("a".repeat(400_001))).toStrictEqual([
      { problem: "tooLarge" },
    ]);
  });

  it("answers 5,000 nested quotes as too large, without exhausting the stack", () => {
    expect(problemsOf(`${">".repeat(5000)} deep`)).toStrictEqual([
      { column: 33, line: 1, problem: "tooLarge" },
    ]);
    expect(
      problemsOf(`${"**a ".repeat(2000)}b${" c**".repeat(2000)}`).every(
        ({ problem }) => problem === "tooLarge"
      )
    ).toBeTruthy();
  });

  it("refuses what the allow-list does not take once read: a list starting past its bound", () => {
    expect(problemsOf("123456789. ok")).toStrictEqual([
      { problem: "notTaken" },
    ]);
  });

  it("reads 400,000 characters within a request's time", () => {
    const markdown = "Sow *early*, [often](https://a.example).\n\n"
      .repeat(9500)
      .slice(0, 400_000);

    const started = performance.now();

    expect(Result.isSuccess(readMarkdown(markdown))).toBeTruthy();
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

interface Example {
  readonly example: number;
  readonly html: string;
  readonly markdown: string;
}

const { examples } = Schema.decodeUnknownSync(
  Schema.Struct({
    examples: Schema.Array(
      Schema.Struct({
        example: Schema.Int,
        html: Schema.String,
        markdown: Schema.String,
      })
    ),
  })
)(
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "fixtures", "commonmark-examples.json"),
      "utf-8"
    )
  )
);

// Where Peal reads the example otherwise than CommonMark's HTML, and why.
const readOtherwise = new Map([
  [265, "a list starting past the allow-list's 1,000,000 is refused"],
  [318, "the syntax tree keeps no last blank line in a code block"],
  // GitHub's extensions link bare addresses, which core CommonMark
  // leaves as text.
  [602, "GitHub's bare address"],
  [606, "GitHub's bare address"],
  [608, "GitHub's bare address"],
  [611, "GitHub's bare address"],
  [612, "GitHub's bare address"],
]);

describe("CommonMark's examples", () => {
  it.each(examples.filter(({ example }) => !readOtherwise.has(example)))(
    "read as the spec's example $example does",
    ({ html, markdown }: Example) => {
      expect(
        htmlOutline(articleHtml(bodyOf(markdown), new Map()))
      ).toStrictEqual(htmlOutline(html));
    }
  );
});

describe("Markdown in, as the sites get it", () => {
  const markdown = [
    "## Sow early",
    "Peas *first*, then [beans](https://garden.example).",
    "```typescript\nconst rows = 3;\n```",
    `![A row of peas](media:${mediaId})`,
  ].join("\n\n");

  const body = () => bodyOf(markdown);

  const images = new Map([
    [MediaAssetIdSchema.make(mediaId), "https://cdn.example/peas.png"],
  ]);

  it("is HTML for WordPress, the language as the code's class", () => {
    expect(articleHtml(body(), images)).toBe(
      [
        "<h2>Sow early</h2>",
        '<p>Peas <em>first</em>, then <a href="https://garden.example">beans</a>.</p>',
        '<pre><code class="language-typescript">const rows = 3;</code></pre>',
        '<figure><img src="https://cdn.example/peas.png" alt="A row of peas"></figure>',
      ].join("\n")
    );
  });

  it("is Markdown for Hashnode and DEV, the language as the fence's info", () => {
    const common = [
      "## Sow early",
      "Peas *first*, then [beans](https://garden.example/)\\.",
      "```typescript\nconst rows = 3;\n```",
      "![A row of peas](https://cdn.example/peas.png)",
    ];

    expect(articleMarkdown(body(), images)).toBe(common.join("\n\n"));
    expect(articleMarkdown(body(), images, "forem")).toBe(common.join("\n\n"));
  });
});
