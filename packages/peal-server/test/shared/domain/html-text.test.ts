import { describe, expect, it } from "@effect/vitest";

import { textOfHtml } from "#shared/domain/html-text.ts";
import { growthOf, linearGrowthAtMost } from "#test/shared/support.ts";

// HTML as plain text: what a comment or a feed's item says, never markup.

describe(textOfHtml, () => {
  it("keeps paragraphs and line breaks, and drops every tag", () => {
    expect(
      textOfHtml(
        '<p>One<br>two <a href="https://example.com">link</a></p><p>Three</p>'
      )
    ).toBe("One\ntwo link\n\nThree");
  });

  it("decodes entities last, so escaped markup stays text", () => {
    expect(textOfHtml("<p>&lt;b&gt; &amp;amp; &#233; &#x1F44D;</p>")).toBe(
      "<b> &amp; é 👍"
    );
  });

  it("decodes every name HTML gives a character, as written", () => {
    // What sites write: typographic quotes, dashes, an ellipsis, letters
    // with their accents, by name; a no-break space stays a space.
    expect(
      textOfHtml(
        "<p>We&rsquo;ve &ldquo;moved&rdquo; &mdash; 1&ndash;2&hellip; &Eacute;t&eacute; &frac12;&nbsp;&euro; &AMP;</p>"
      )
    ).toBe(
      "We\u2019ve \u201Cmoved\u201D \u2014 1\u20132\u2026 \u00C9t\u00E9 \u00BD \u20AC &"
    );
  });

  it("keeps a name HTML does not give, or one without its semicolon", () => {
    expect(textOfHtml("<p>&notaname; &EACUTE; &copy and &amp</p>")).toBe(
      "&notaname; &EACUTE; &copy and &amp"
    );
  });

  it("makes no character of a reference that names none", () => {
    // Half a surrogate pair, NUL, and a number past the last code point
    // stay as they were written: text, and well formed.
    const text = textOfHtml("<p>a&#xD800;b&#xDFFF;c&#0;d&#x110000;</p>");

    expect(text).toBe("a&#xD800;b&#xDFFF;c&#0;d&#x110000;");
    expect(text.isWellFormed()).toBeTruthy();
  });

  it("drops what a script or a style holds, however it is written", () => {
    expect(
      textOfHtml(
        "<p>Before</p><SCRIPT type='x'>alert('a <b>')</SCRIPT ><style>p{}</style><p>after</p>"
      )
    ).toBe("Before\n\nafter");
  });

  it("drops the rest of a script that never closes", () => {
    expect(textOfHtml("<p>Kept</p><script>never closed")).toBe("Kept");
  });

  it("reads a long run of unclosed scripts in linear time", () => {
    expect(
      growthOf(textOfHtml, (times) => "<script>".repeat(times), 16_384).growth
    ).toBeLessThan(linearGrowthAtMost);
    expect(textOfHtml("<script>".repeat(200_000))).toBe("");
  });

  it("strips tags in linear time, however many open without closing", () => {
    const hostile = "<".repeat(2 * 1024 * 1024);

    expect(
      growthOf(textOfHtml, (times) => "<".repeat(times), 16_384).growth
    ).toBeLessThan(linearGrowthAtMost);
    expect(textOfHtml(hostile)).toBe(hostile);
  });

  it("still makes a paragraph break between paragraphs, and drops other tags", () => {
    expect(textOfHtml("<p>a</p>\n <p class='x'>b</p> <i>c</i><BR/>d")).toBe(
      "a\n\nb c\nd"
    );
  });
});
