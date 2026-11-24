// Which limit holds a request's body, by its address, and when a declared
// length is past it. The whole server's answers are in body-limits.test.ts.
import { describe, expect, it } from "@effect/vitest";
import { ByteSize } from "effect";

import {
  bodyLimitFor,
  contentBodyLimit,
  declaredPastLimit,
  defaultBodyLimit,
} from "#app/body-limits.ts";

describe(bodyLimitFor, () => {
  it("takes a workspace's content in larger bodies", () => {
    for (const path of [
      "/api/v1/posts/bulk",
      "/api/v1/posts",
      "/api/v1/posts/drafts",
      "/api/v1/posts/p1/schedule",
      "/api/v1/articles/x",
      "/api/mcp",
    ]) {
      expect(bodyLimitFor(path)).toBe(contentBodyLimit);
    }
  });

  it("takes the rest in 1 MiB", () => {
    for (const path of [
      "/api/v1/posts/tags",
      "/api/v1/posts/tags/t1",
      "/api/v1/posts/signatures",
      "/api/v1/posts/signatures/s1",
      "/api/v1/approvals/p1/comments",
      "/api/v1/approvals/settings",
      "/api/v1/postsearch",
      "/api/auth/sign-in/email",
      "/api/data-deletion/facebook",
      "/api/mcp/server-card",
    ]) {
      expect(bodyLimitFor(path)).toBe(defaultBodyLimit);
    }
  });
});

describe(declaredPastLimit, () => {
  it("refuses a declared length past the limit, and nothing else", () => {
    const limit = ByteSize.bytes(10);

    expect(declaredPastLimit("11", limit)).toBeTruthy();
    expect(declaredPastLimit("10", limit)).toBeFalsy();
    expect(declaredPastLimit(undefined, limit)).toBeFalsy();
    expect(declaredPastLimit("ten", limit)).toBeFalsy();
  });
});
