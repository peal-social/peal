import { describe, expect, it } from "bun:test";

import { breakingOf, checkAccepted, movesOf } from "./accepted-changes.ts";

const documentChange = {
  change: "Post.status lost the value archived",
  reason: "Synthetic: decided on.",
};

// A change the document does not show: what an endpoint refuses now.
const behaviour = {
  change: "PUT /api/x refuses OAuth clients",
  kind: "behaviour" as const,
  reason: "Synthetic: closes a hole.",
};

// Operations that moved, a path parameter left behind.
const move = {
  change: "Every operation under /api/teams/{teamId} answers under /api/v2",
  dropping: "teamId",
  from: "/api/teams/{teamId}",
  kind: "move" as const,
  reason: "Synthetic: decided on.",
  to: "/api/v2",
};

describe("checkAccepted", () => {
  it("matches the document's breaking changes against those accepted", () => {
    expect(
      checkAccepted(
        ["Post.status lost the value archived", "Other"],
        [documentChange]
      )
    ).toStrictEqual({ stale: [], unaccepted: ["Other"] });
  });

  it("calls stale an accepted document change that no longer happens", () => {
    expect(checkAccepted([], [documentChange])).toStrictEqual({
      stale: [documentChange],
      unaccepted: [],
    });
  });

  it("keeps a behaviour or SDK change, which the document cannot show", () => {
    expect(
      checkAccepted([], [behaviour, { ...behaviour, kind: "sdk" }])
    ).toStrictEqual({ stale: [], unaccepted: [] });
  });

  it("keeps a move while it moves an operation, and calls it stale once it moves none", () => {
    expect(checkAccepted([], [move], [move])).toStrictEqual({
      stale: [],
      unaccepted: [],
    });
    expect(checkAccepted([], [move], [])).toStrictEqual({
      stale: [move],
      unaccepted: [],
    });
    // A move accepts none of the breaks the document still shows.
    expect(checkAccepted(["posts.list is gone"], [move], [move])).toStrictEqual(
      { stale: [], unaccepted: ["posts.list is gone"] }
    );
  });
});

describe("movesOf", () => {
  it("takes the moves among the accepted changes", () => {
    expect(movesOf([documentChange, move, behaviour])).toStrictEqual([move]);
  });
});

describe("breakingOf", () => {
  it("lists every accepted change in the changelog, as it serves them", () => {
    expect(breakingOf([documentChange, behaviour])).toStrictEqual([
      documentChange,
      { change: behaviour.change, reason: behaviour.reason },
    ]);
  });
});
