import { describe, expect, it } from "@effect/vitest";

import { chipLength, excerptOf } from "#components/posts/post-commands.tsx";

describe(excerptOf, () => {
  it("keeps a short text as it is, on one line", () => {
    expect(excerptOf("Launch day\n\nwith  the team")).toBe(
      "Launch day with the team"
    );
  });

  it("cuts a long text to the chip's length, with an ellipsis", () => {
    const excerpt = excerptOf("A".repeat(100));

    expect(excerpt).toHaveLength(chipLength);
    expect(excerpt?.endsWith("…")).toBeTruthy();
  });

  it("names nothing for a post without text", () => {
    expect(excerptOf("  \n ")).toBeNull();
  });
});
