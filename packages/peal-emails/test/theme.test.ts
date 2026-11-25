import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { colors, stateDots } from "../src/components/theme.ts";

const design = readFileSync(
  path.join(import.meta.dirname, "../../../DESIGN.md"),
  "utf-8"
);

// The front matter's colours, by token.
const tokens = new Map(
  [
    ...design.matchAll(/^ {2}(?<token>[a-z0-9-]+): "(?<hex>#[0-9A-F]{6})"$/gmu),
  ].map(({ groups }) => [
    groups?.["token"] ?? "",
    (groups?.["hex"] ?? "").toLowerCase(),
  ])
);

describe("the emails' theme", () => {
  it("takes each colour from DESIGN.md", () => {
    expect(colors).toStrictEqual({
      brandText: tokens.get("brand-text"),
      canvas: tokens.get("canvas"),
      hairline: tokens.get("hairline"),
      ink: tokens.get("ink"),
      muted: tokens.get("ink-subtle"),
      onInk: tokens.get("on-primary"),
      quiet: tokens.get("surface-2"),
      surface: tokens.get("surface-1"),
    });
  });

  it("gives each state its dot", () => {
    expect(stateDots).toStrictEqual({
      approval: tokens.get("state-approval"),
      failed: tokens.get("state-failed"),
      published: tokens.get("state-published"),
      scheduled: tokens.get("state-scheduled"),
      unconfirmed: tokens.get("state-draft"),
    });
  });
});
