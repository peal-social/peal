// The agent writes markdown limited to paragraphs, lists, bold, italics,
// inline code and links. This reads that subset into a tree the view
// renders as React elements: never HTML, so a tag in the text stays text,
// and a link only where its address is this origin's path or http(s).

export type Inline =
  | { readonly _tag: "text"; readonly text: string }
  | { readonly _tag: "code"; readonly text: string }
  | { readonly _tag: "strong"; readonly children: readonly Inline[] }
  | { readonly _tag: "em"; readonly children: readonly Inline[] }
  | {
      readonly _tag: "link";
      readonly children: readonly Inline[];
      readonly href: string;
      /** A path of this origin, opened in place; otherwise a new tab. */
      readonly internal: boolean;
    }
  | { readonly _tag: "break" };

export type Block =
  | { readonly _tag: "paragraph"; readonly children: readonly Inline[] }
  | {
      readonly _tag: "list";
      readonly items: readonly (readonly Inline[])[];
      readonly ordered: boolean;
    };

/**
 * Where a link may lead: a path of this origin (`/…`, never `//…`), or an
 * http(s) address. Anything else (`javascript:`, `data:`, a relative
 * path) renders as its text alone.
 */
export const linkTarget = (
  href: string
): { readonly href: string; readonly internal: boolean } | null => {
  const address = href.trim();

  if (address.startsWith("/")) {
    return address.startsWith("//") || address.startsWith("/\\")
      ? null
      : { href: address, internal: true };
  }

  if (!URL.canParse(address)) {
    return null;
  }

  const url = new URL(address);

  return url.protocol === "https:" || url.protocol === "http:"
    ? { href: url.href, internal: false }
    : null;
};

const isWordCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character);

const pushText = (into: Inline[], text: string): void => {
  if (text === "") {
    return;
  }

  const last = into.at(-1);

  if (last?._tag === "text") {
    into[into.length - 1] = { _tag: "text", text: last.text + text };
  } else {
    into.push({ _tag: "text", text });
  }
};

// The closing bracket of a link's text, with nested brackets counted.
const closingBracket = (source: string, from: number): number => {
  let depth = 0;

  for (let index = from; index < source.length; index += 1) {
    const character = source[index];

    if (character === "\\") {
      index += 1;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      if (depth === 0) {
        return index;
      }

      depth -= 1;
    }
  }

  return -1;
};

const emphasisAt = (
  source: string,
  index: number
): { readonly marker: string; readonly strong: boolean } | null => {
  const character = source[index];

  if (character !== "*" && character !== "_") {
    return null;
  }

  const strong = source[index + 1] === character;
  const marker = strong ? character.repeat(2) : character;
  const after = source[index + marker.length];

  // An opening marker touches what it emphasises; `_` inside a word
  // (snake_case) is no marker.
  if (after === undefined || after === " " || after === character) {
    return null;
  }

  if (character === "_" && isWordCharacter(source[index - 1])) {
    return null;
  }

  return { marker, strong };
};

const closingMarker = (
  source: string,
  from: number,
  marker: string
): number => {
  let index = source.indexOf(marker, from);

  while (index !== -1) {
    const before = source[index - 1];
    const after = source[index + marker.length];

    const closes =
      before !== " " &&
      (!marker.startsWith("_") || !isWordCharacter(after)) &&
      // `*` alone never closes on the first of a `**`.
      (marker.length === 2 || after !== marker);

    if (closes && index > from) {
      return index;
    }

    index = source.indexOf(marker, index + 1);
  }

  return -1;
};

// A mark read at a position: the nodes it makes, and where reading goes on;
// null when the character there opens nothing.
interface Read {
  readonly nodes: readonly Inline[];
  readonly next: number;
}

const codeAt = (source: string, index: number): Read | null => {
  const end = source.indexOf("`", index + 1);

  return end === -1
    ? null
    : {
        next: end + 1,
        nodes: [{ _tag: "code", text: source.slice(index + 1, end) }],
      };
};

const linkAt = (source: string, index: number): Read | null => {
  const close = closingBracket(source, index + 1);

  const end =
    close !== -1 && source[close + 1] === "("
      ? source.indexOf(")", close + 2)
      : -1;

  if (end === -1) {
    return null;
  }

  const children = parseInline(source.slice(index + 1, close));
  const target = linkTarget(source.slice(close + 2, end));

  return {
    next: end + 1,
    nodes: target === null ? children : [{ _tag: "link", children, ...target }],
  };
};

const emphasizedAt = (source: string, index: number): Read | null => {
  const emphasis = emphasisAt(source, index);

  if (emphasis === null) {
    return null;
  }

  const start = index + emphasis.marker.length;
  const end = closingMarker(source, start, emphasis.marker);

  if (end === -1) {
    return null;
  }

  const children = parseInline(source.slice(start, end));

  return {
    next: end + emphasis.marker.length,
    nodes: [
      emphasis.strong ? { _tag: "strong", children } : { _tag: "em", children },
    ],
  };
};

const markAt = (source: string, index: number): Read | null => {
  switch (source.charAt(index)) {
    case "\\": {
      return index + 1 < source.length
        ? {
            next: index + 2,
            nodes: [{ _tag: "text", text: source[index + 1] ?? "" }],
          }
        : null;
    }

    case "\n": {
      return { next: index + 1, nodes: [{ _tag: "break" }] };
    }

    case "`": {
      return codeAt(source, index);
    }

    case "[": {
      return linkAt(source, index);
    }

    default: {
      return emphasizedAt(source, index);
    }
  }
};

/** The inline marks of one paragraph's or one item's text. */
export const parseInline = (source: string): readonly Inline[] => {
  const nodes: Inline[] = [];
  let index = 0;

  while (index < source.length) {
    const read = markAt(source, index);

    if (read === null) {
      pushText(nodes, source[index] ?? "");
      index += 1;
    } else {
      for (const node of read.nodes) {
        if (node._tag === "text") {
          pushText(nodes, node.text);
        } else {
          nodes.push(node);
        }
      }

      index = read.next;
    }
  }

  return nodes;
};

const bullet = /^\s{0,3}[-*+]\s+(?<text>.*)$/u;

const numbered = /^\s{0,3}\d{1,9}[.)]\s+(?<text>.*)$/u;

// A heading's marks, which the agent should not write: its words stay.
const heading = /^\s{0,3}#{1,6}\s+/u;

interface ListItemLine {
  readonly ordered: boolean;
  readonly text: string;
}

const itemOf = (line: string): ListItemLine | null => {
  const { text: unordered } = bullet.exec(line)?.groups ?? {};

  if (unordered !== undefined) {
    return { ordered: false, text: unordered };
  }

  const { text: ordered } = numbered.exec(line)?.groups ?? {};

  return ordered === undefined ? null : { ordered: true, text: ordered };
};

/** The blocks of the agent's markdown: paragraphs and lists. */
export const parseMarkdown = (source: string): readonly Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({
        _tag: "paragraph",
        children: parseInline(paragraph.join("\n")),
      });
      paragraph = [];
    }

    if (list !== null) {
      blocks.push({
        _tag: "list",
        items: list.items.map((item) => parseInline(item)),
        ordered: list.ordered,
      });
      list = null;
    }
  };

  for (const raw of source.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.replace(heading, "");
    const item = itemOf(line);

    if (line.trim() === "") {
      flush();
    } else if (item !== null) {
      if (
        paragraph.length > 0 ||
        (list !== null && list.ordered !== item.ordered)
      ) {
        flush();
      }

      list ??= { items: [], ordered: item.ordered };
      list.items.push(item.text);
    } else if (list === null) {
      paragraph.push(line.trim());
    } else {
      // A line under an item, not itself one, goes on with it.
      const last = list.items.length - 1;

      list.items[last] = `${list.items[last] ?? ""} ${line.trim()}`;
    }
  }

  flush();

  return blocks;
};
