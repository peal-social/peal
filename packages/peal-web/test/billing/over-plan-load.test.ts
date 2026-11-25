import { describe, expect, it } from "@effect/vitest";
import { AsyncResult } from "effect/reactivity";

import { listLoadOf } from "#billing/over-plan-load.ts";

const read = AsyncResult.success([]);
const unread = AsyncResult.initial();
const failed = AsyncResult.fail("unavailable");

describe(listLoadOf, () => {
  it.each([
    ["failed", failed],
    ["read", read],
    ["not been read", unread],
  ] as const)(
    "loads before hydration whatever the query holds, here %s, as the server's render has it failed already",
    (_, list) => {
      expect(listLoadOf(false, list)).toBe("loading");
    }
  );

  it("loads while the browser reads the list", () => {
    expect(listLoadOf(true, unread)).toBe("loading");
    expect(listLoadOf(true, AsyncResult.initial(true))).toBe("loading");
  });

  it("shows the list once the browser has read it, and keeps it while it is read again", () => {
    expect(listLoadOf(true, read)).toBe("ready");
    expect(listLoadOf(true, AsyncResult.success([], { waiting: true }))).toBe(
      "ready"
    );
  });

  it("says the browser could not read the list", () => {
    expect(listLoadOf(true, failed)).toBe("failed");
  });

  it("loads again while the list is read again after a failure, as Try again does", () => {
    expect(
      listLoadOf(true, AsyncResult.fail("unavailable", { waiting: true }))
    ).toBe("loading");
  });
});
