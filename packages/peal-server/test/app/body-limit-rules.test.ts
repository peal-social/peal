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

const workspaceId = "5b0c6e64-5d0f-4a7e-9a52-3f1c2d4e5f60";

describe(bodyLimitFor, () => {
  it("takes a workspace's content in larger bodies", () => {
    for (const path of [
      `/api/workspaces/${workspaceId}/posts/bulk`,
      `/api/workspaces/${workspaceId}/posts`,
      `/api/workspaces/${workspaceId}/articles/x`,
      "/api/mcp",
    ]) {
      expect(bodyLimitFor(path)).toBe(contentBodyLimit);
    }
  });

  it("takes the rest in 1 MiB", () => {
    for (const path of [
      `/api/workspaces/${workspaceId}/tags`,
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
