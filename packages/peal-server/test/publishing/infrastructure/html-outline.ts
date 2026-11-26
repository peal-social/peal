// The outline of a body's HTML, for comparing Peal's with CommonMark's
// examples: its blocks as tokens, its text as runs with the set of marks
// each has, whatever order the marks nest in and however often one
// repeats (the editor keeps a mark once), a paragraph's tags and the
// spaces at a block's edges left out (a tight list's items have no
// paragraph in CommonMark's HTML, and always one in the editor's), an
// address as it reads once its escapes are decoded.

const structural = new Set([
  "blockquote",
  "h2",
  "h3",
  "h4",
  "hr",
  "li",
  "ol",
  "pre",
  "ul",
]);

const markOf = new Map([
  ["code", "code"],
  ["del", "strike"],
  ["em", "italic"],
  ["s", "strike"],
  ["strong", "bold"],
]);

const entities = new Map([
  ["&#039;", "'"],
  ["&amp;", "&"],
  ["&gt;", ">"],
  ["&lt;", "<"],
  ["&quot;", '"'],
]);

const decoded = (text: string) =>
  text.replaceAll(
    /&#039;|&amp;|&gt;|&lt;|&quot;/gu,
    (entity) => entities.get(entity) ?? entity
  );

const paragraphEdge = "¶";

const addressOf = (href: string) => {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
};

const tagPattern =
  /<(?<closing>\/?)(?<name>[a-z0-9]+)(?<attributes>(?:\s[^>]*)?)>/gu;

interface Tag {
  readonly attributes: string;
  readonly closing: string;
  readonly name: string;
}

const hrefOf = (attributes: string) => {
  const { href = "" } = /href="(?<href>[^"]*)"/u.exec(attributes)?.groups ?? {};

  return addressOf(decoded(href));
};

/** What the reading of the HTML holds, tag after tag. */
class Outline {
  readonly tokens: string[] = [];

  private inPre = false;

  private readonly marks: string[] = [];

  private run: { marks: string; text: string } | undefined;

  flush() {
    if (this.run !== undefined) {
      this.tokens.push(`${this.run.marks}|${this.run.text}`);
    }

    this.run = undefined;
  }

  text(value: string) {
    if (value === "") {
      return;
    }

    const key = this.inPre
      ? "pre"
      : [...new Set(this.marks)].toSorted().join(",");

    if (this.run?.marks === key) {
      this.run.text += value;
    } else {
      this.flush();
      this.run = { marks: key, text: value };
    }
  }

  block({ attributes, closing, name }: Tag) {
    this.flush();

    if (name === "br") {
      this.tokens.push("<br>");
    } else if (name === "p") {
      this.tokens.push(paragraphEdge);
    } else {
      const { start } = /start="(?<start>\d+)"/u.exec(attributes)?.groups ?? {};

      this.tokens.push(
        `<${closing}${name}${start === undefined ? "" : ` ${start}`}>`
      );
      this.inPre = name === "pre" ? closing === "" : this.inPre;
    }
  }

  mark({ attributes, closing, name }: Tag) {
    const mark = name === "a" ? `link:${hrefOf(attributes)}` : markOf.get(name);

    if (mark === undefined || this.inPre) {
      return;
    }

    if (closing === "") {
      this.marks.push(mark);

      return;
    }

    const prefix = name === "a" ? "link:" : mark;

    this.marks.splice(
      this.marks.findLastIndex((held) => held.startsWith(prefix)),
      1
    );
  }
}

const isRun = (token: string | undefined) => token?.includes("|") === true;

// Runs of spaces alone between blocks, and the spaces at a block's
// edges, are no text.
const trimmedRuns = (tokens: readonly string[]) =>
  tokens.flatMap((token, index) => {
    const [key = "", ...rest] = token.split("|");

    if (rest.length === 0) {
      return token === paragraphEdge ? [] : [token];
    }

    // A code block's last line ending is no line of it.
    if (key === "pre") {
      return [token.replace(/\n$/u, "")];
    }

    // A soft line break is a space in the editor, as a browser shows it.
    let value = rest.join("|").replaceAll(/\s+/gu, " ");

    if (!isRun(tokens[index - 1])) {
      value = value.trimStart();
    }

    if (!isRun(tokens[index + 1])) {
      value = value.trimEnd();
    }

    return value === "" ? [] : [`${key}|${value}`];
  });

/** The HTML's blocks and text runs, as comparable tokens. */
export const htmlOutline = (html: string): readonly string[] => {
  const outline = new Outline();
  let at = 0;

  for (const match of html.matchAll(tagPattern)) {
    outline.text(decoded(html.slice(at, match.index)));
    at = match.index + match[0].length;

    const { attributes = "", closing = "", name = "" } = match.groups ?? {};
    const tag = { attributes, closing, name };

    if (structural.has(name) || name === "p" || name === "br") {
      outline.block(tag);
    } else {
      outline.mark(tag);
    }
  }

  outline.text(decoded(html.slice(at)));
  outline.flush();

  return trimmedRuns(outline.tokens);
};
