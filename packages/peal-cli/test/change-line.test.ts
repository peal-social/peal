import { describe, expect, it } from "@effect/vitest";

import { refusedChangeText } from "#commands/posts-unpublish.ts";

describe(refusedChangeText, () => {
  it("tells to change a post on Discord that another webhook sent", () => {
    expect(refusedChangeText("remove", "News", "webhookChanged")).toBe(
      "Could not delete it from News: another webhook sent this post, and Discord lets only that one change it. Remove it on Discord."
    );
    expect(refusedChangeText("edit", "News", "webhookChanged")).toBe(
      "Could not edit it on News: another webhook sent this post, and Discord lets only that one change it. Edit it on Discord."
    );
    expect(refusedChangeText("remove", "News", "unavailable")).toBeUndefined();
  });
});
