import { DateTime } from "effect";
import { describe, expect, it } from "@effect/vitest";
import type { Post, PostStatus } from "peal-contract";

import { composerTitleOf } from "#posts/composer-title.ts";

const postIn = (status: PostStatus): Post => ({
  authorId: "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f",
  content: { media: [], overrides: [], text: "A synthetic post" },
  createdAt: DateTime.makeUnsafe("2026-11-01T09:00:00Z"),
  createdVia: null,
  externalId: null,
  id: "00000000-0000-7000-8000-000000000001",
  occurrence: null,
  outcome: null,
  queueId: null,
  recyclingId: null,
  schedule: null,
  scheduledBy: null,
  scheduledVia: null,
  shortenLinks: false,
  status,
  tagIds: [],
  updatedAt: DateTime.makeUnsafe("2026-11-01T09:00:00Z"),
  targets: [],
});

describe(composerTitleOf, () => {
  it("names a post not saved yet a new post", () => {
    expect(composerTitleOf(undefined, false)).toBe("newTitle");
  });

  it("names a new post a draft once its first save made it one", () => {
    expect(composerTitleOf(undefined, true)).toBe("editTitle");
  });

  it("names an existing post by its status", () => {
    expect(composerTitleOf(postIn("draft"), true)).toBe("editTitle");
    expect(composerTitleOf(postIn("awaitingApproval"), true)).toBe(
      "awaitingTitle"
    );
    expect(composerTitleOf(postIn("scheduled"), true)).toBe("scheduledTitle");
    expect(composerTitleOf(postIn("finished"), true)).toBe("closedTitle");
  });
});
