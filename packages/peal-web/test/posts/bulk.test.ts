import { describe, expect, it } from "@effect/vitest";
import { maxTagsPerPost } from "peal-contract";

import {
  allOf,
  decisionsOf,
  extended,
  keptTo,
  mayCancel,
  mayUnschedule,
  nextFocus,
  noSelection,
  tagStateOf,
  toggled,
  withoutTag,
  withRange,
  withTag,
} from "#posts/bulk.ts";

const order = ["a", "b", "c", "d", "e"];

const idsOf = ({ ids }: { readonly ids: ReadonlySet<string> }) =>
  [...ids].toSorted();

describe(toggled, () => {
  it("puts a post in, then takes it out, and remembers it as the start", () => {
    const once = toggled(noSelection, "b");
    const twice = toggled(once, "b");

    expect([idsOf(once), once.anchor, idsOf(twice)]).toStrictEqual([
      ["b"],
      "b",
      [],
    ]);
  });
});

describe(withRange, () => {
  it("puts in every post from the last one clicked, either way", () => {
    expect(
      idsOf(withRange(toggled(noSelection, "b"), order, "d"))
    ).toStrictEqual(["b", "c", "d"]);
    expect(
      idsOf(withRange(toggled(noSelection, "d"), order, "b"))
    ).toStrictEqual(["b", "c", "d"]);
  });

  it("takes the range out when the post clicked was in", () => {
    const all = withRange(toggled(noSelection, "a"), order, "e");

    expect(idsOf(withRange({ ...all, anchor: "b" }, order, "d"))).toStrictEqual(
      ["a", "e"]
    );
  });

  it("toggles the post alone without a start", () => {
    expect(idsOf(withRange(noSelection, order, "c"))).toStrictEqual(["c"]);
  });
});

describe(keptTo, () => {
  it("drops the posts no longer listed, and their start", () => {
    const kept = keptTo({ anchor: "z", ids: new Set(["a", "z"]) }, order);

    expect([idsOf(kept), kept.anchor]).toStrictEqual([["a"], null]);
  });
});

describe(mayCancel, () => {
  it("cancels what has not gone out, and takes back to draft what waits", () => {
    const statuses = [
      "draft",
      "awaitingApproval",
      "scheduled",
      "publishing",
      "finished",
      "cancelled",
    ] as const;

    expect(
      statuses.map((status) => [
        status,
        mayCancel({ status }),
        mayUnschedule({ status }),
      ])
    ).toStrictEqual([
      ["draft", true, false],
      ["awaitingApproval", true, true],
      ["scheduled", true, true],
      ["publishing", false, false],
      ["finished", false, false],
      ["cancelled", false, false],
    ]);
  });
});

describe(decisionsOf, () => {
  const waiting = { id: "a", status: "awaitingApproval" } as const;

  const pending = {
    id: "approval-a",
    postId: "a",
    status: "pending",
    subjectHash: "5a".repeat(32),
  } as const;

  it("decides on a waiting post with the approval the list of approvals gave", () => {
    expect(decisionsOf([waiting], [pending])).toStrictEqual([
      {
        post: waiting,
        shown: { approvalId: "approval-a", subjectHash: "5a".repeat(32) },
      },
    ]);
  });

  it("leaves out a post that does not wait, or whose approval is not listed", () => {
    expect(
      decisionsOf(
        [
          { id: "b", status: "scheduled" },
          { id: "c", status: "awaitingApproval" },
          waiting,
        ],
        [
          { ...pending, id: "approval-b", postId: "b" },
          { ...pending, id: "approval-c", postId: "c", status: "approved" },
        ]
      )
    ).toStrictEqual([]);
  });
});

describe(allOf, () => {
  it("chooses every listed post", () => {
    expect(idsOf(allOf(order))).toStrictEqual(order);
  });
});

describe(nextFocus, () => {
  it("moves down and up, starts at an end, and stops at the ends", () => {
    expect([
      nextFocus(order, "b", 1),
      nextFocus(order, "b", -1),
      nextFocus(order, null, 1),
      nextFocus(order, null, -1),
      nextFocus(order, "e", 1),
      nextFocus(order, "a", -1),
      nextFocus([], null, 1),
    ]).toStrictEqual(["c", "a", "a", "e", "e", "a", null]);
  });
});

describe(extended, () => {
  it("chooses the focused post and the next, and moves on", () => {
    const once = extended(noSelection, order, "b", 1);
    const twice = extended(once.selection, order, once.focused, 1);

    expect([idsOf(twice.selection), twice.focused]).toStrictEqual([
      ["b", "c", "d"],
      "d",
    ]);
  });
});

describe(tagStateOf, () => {
  it("says whether all, some or none of the posts have a tag", () => {
    const posts = [{ tagIds: ["news"] }, { tagIds: ["news", "launch"] }];

    expect([
      tagStateOf(posts, "news"),
      tagStateOf(posts, "launch"),
      tagStateOf(posts, "event"),
    ]).toStrictEqual(["all", "some", "none"]);
  });
});

describe(withoutTag, () => {
  it("takes a tag off a post that has it", () => {
    expect([
      withoutTag(["news", "launch"], "news"),
      withoutTag(["launch"], "news"),
    ]).toStrictEqual([["launch"], null]);
  });
});

describe(withTag, () => {
  it("adds a tag a post lacks, within the most a post may hold", () => {
    const full = Array.from({ length: maxTagsPerPost }, (_, index) =>
      String(index)
    );

    expect([
      withTag(["news"], "launch"),
      withTag(["news"], "news"),
      withTag(full, "launch"),
    ]).toStrictEqual([["news", "launch"], null, null]);
  });
});
