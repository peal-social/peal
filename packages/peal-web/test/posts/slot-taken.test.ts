import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { PostStatus } from "peal-contract";

import { slotTakenBy } from "#posts/slot-taken.ts";

const slot = DateTime.makeUnsafe("2026-11-23T07:00:00Z");
const later = DateTime.makeUnsafe("2026-11-24T07:00:00Z");

const post = (
  id: string,
  at: DateTime.Utc | null,
  status: PostStatus = "scheduled",
  queueId: string | null = "mornings"
) => ({
  id,
  queueId,
  schedule: at === null ? null : { at, timeZone: "Europe/Helsinki" },
  status,
});

const moving = { at: slot, postId: "moved", queueId: "mornings" };

describe(slotTakenBy, () => {
  it("finds another post of the queue waiting on the slot", () => {
    expect(slotTakenBy([post("other", slot)], moving)).toBeTruthy();
  });

  it("counts a post awaiting approval or going out", () => {
    expect(
      slotTakenBy([post("other", slot, "awaitingApproval")], moving)
    ).toBeTruthy();
    expect(
      slotTakenBy([post("other", slot, "publishing")], moving)
    ).toBeTruthy();
  });

  it("leaves out the post being moved back itself", () => {
    expect(slotTakenBy([post("moved", slot)], moving)).toBeFalsy();
  });

  it("leaves out a post of another queue or with a time of its own", () => {
    expect(
      slotTakenBy(
        [
          post("other", slot, "scheduled", "evenings"),
          post("hand", slot, "scheduled", null),
        ],
        moving
      )
    ).toBeFalsy();
  });

  it("leaves out a post cancelled or done, or at another time", () => {
    expect(
      slotTakenBy(
        [
          post("cancelled", slot, "cancelled"),
          post("finished", slot, "finished"),
          post("elsewhere", later),
          post("draft", null, "draft"),
        ],
        moving
      )
    ).toBeFalsy();
  });
});
