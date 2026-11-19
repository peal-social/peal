import { describe, expect, it } from "@effect/vitest";

import { personalPageAt } from "#shell/personal.ts";

describe(personalPageAt, () => {
  it("names the person's pages, the notices' preferences under the notices", () => {
    expect(personalPageAt("/agenda")).toBe("agenda");
    expect(personalPageAt("/report")).toBe("report");
    expect(personalPageAt("/notices/preferences")).toBe("notices");
    expect(personalPageAt("/account")).toBe("account");
    expect(personalPageAt("/new")).toBe("newWorkspace");
  });

  it("names no page elsewhere, /app and a workspace's pages included", () => {
    expect(personalPageAt("/")).toBeNull();
    expect(personalPageAt("/0190a1b2-0000-7000-8000-000000000001")).toBeNull();
    expect(personalPageAt("/maximes-workspace-1a2b3c4d")).toBeNull();
    expect(personalPageAt("/accounts")).toBeNull();
  });
});
