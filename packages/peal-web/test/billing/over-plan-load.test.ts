import { describe, expect, it } from "@effect/vitest";
import { AsyncResult } from "effect/reactivity";

import { overPlanLoadOf } from "#billing/over-plan-load.ts";

const read = AsyncResult.success([]);
const unread = AsyncResult.initial();
const failed = AsyncResult.fail("unavailable");

describe(overPlanLoadOf, () => {
  it.each([
    ["has read nothing", unread, unread],
    ["has read the members alone", unread, read],
    ["has read the channels alone", read, unread],
  ] as const)(
    "loads for a member who manages billing while the browser %s",
    (_, channels, members) => {
      expect(
        overPlanLoadOf({ canManage: true, channels, hydrated: true, members })
      ).toBe("loading");
    }
  );

  it.each([
    ["failed", failed, failed],
    ["read", read, read],
    ["not been read", unread, unread],
  ] as const)(
    "loads before hydration whatever the queries hold, here %s, as the server's render has them failed already",
    (_, channels, members) => {
      expect(
        overPlanLoadOf({ canManage: true, channels, hydrated: false, members })
      ).toBe("loading");
    }
  );

  it("shows the screen once the browser has read the channels and the members", () => {
    expect(
      overPlanLoadOf({
        canManage: true,
        channels: read,
        hydrated: true,
        members: read,
      })
    ).toBe("ready");
  });

  it.each([
    ["the channels", failed, read],
    ["the members", read, failed],
    ["either, still loading the other", failed, unread],
  ] as const)("says the browser could not read %s", (_, channels, members) => {
    expect(
      overPlanLoadOf({ canManage: true, channels, hydrated: true, members })
    ).toBe("failed");
  });

  it.each([
    ["before hydration", false, unread],
    ["while loading", true, unread],
    ["when the members could not be read", true, failed],
  ] as const)(
    "shows the screen at once %s to a member who does not manage billing, who chooses nothing",
    (_, hydrated, members) => {
      expect(
        overPlanLoadOf({
          canManage: false,
          channels: failed,
          hydrated,
          members,
        })
      ).toBe("ready");
    }
  );
});
