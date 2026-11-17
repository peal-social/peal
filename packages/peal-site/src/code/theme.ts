import type { CodeTokenKind } from "peal-ui/lib/highlighted-code";
import type { ThemeRegistration } from "shiki";

// Peal's Shiki theme (DESIGN.md, Code). It names peal-ui's `--code-*`
// variables, never a value, so tokens.css is the one place the colours are
// written; highlight.ts reads each run's kind back from its variable. The
// scopes are TextMate's: the most specific selector wins, so
// `punctuation.definition.string` (a string's quotes) beats `punctuation`.

const colour = (name: CodeTokenKind | "background" | "foreground") =>
  `var(--code-${name})`;

const scopes: Readonly<Record<CodeTokenKind, readonly string[]>> = {
  comment: [
    "comment",
    "punctuation.definition.comment",
    "string.quoted.docstring",
  ],
  constant: [
    "constant.numeric",
    "constant.language",
    "constant.character",
    "support.constant",
    "variable.language.this",
    "variable.language.self",
    "variable.language.super",
  ],
  deleted: ["invalid", "markup.deleted", "punctuation.definition.deleted"],
  keyword: [
    "keyword",
    "keyword.operator.new",
    "keyword.operator.expression",
    "keyword.operator.word",
    "storage",
    "storage.type.function",
    "storage.modifier",
    "support.type.property-name.json",
    "punctuation.support.type.property-name",
    "variable.other.normal.shell",
    "constant.other.option",
    "entity.name.tag",
  ],
  punctuation: [
    "punctuation",
    "keyword.operator",
    "meta.brace",
    "punctuation.definition.template-expression",
    "punctuation.separator.key-value",
    "constant.character.escape.line-continuation",
  ],
  string: [
    "string",
    "punctuation.definition.string",
    "string.quoted",
    "string.template",
  ],
  type: [
    "entity.name.type",
    "entity.name.class",
    "entity.other.inherited-class",
    "support.class",
    "support.type",
    "storage.type.java",
    "storage.type.generic.java",
    "storage.type.object.array.java",
    "storage.type.cs",
    "entity.name.type.rust",
  ],
};

// Names that read as plain text, though their grammar files them under a
// kind: a Java import's package path, a shell command's bare arguments.
const plain = [
  "storage.modifier.import.java",
  "storage.modifier.package.java",
  "string.unquoted.argument",
];

/** The theme, light only, on `muted`. Nothing bold or italic. */
export const pealTheme: ThemeRegistration = {
  colors: {
    "editor.background": colour("background"),
    "editor.foreground": colour("foreground"),
  },
  name: "peal",
  settings: [
    {
      settings: {
        background: colour("background"),
        foreground: colour("foreground"),
      },
    },
    ...Object.entries(scopes).map(([kind, scope]) => ({
      scope: [...scope],
      settings: { foreground: `var(--code-${kind})` },
    })),
    { scope: plain, settings: { foreground: colour("foreground") } },
  ],
  type: "light",
};
