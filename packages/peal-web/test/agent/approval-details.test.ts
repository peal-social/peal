import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { AgentMessage } from "peal-contract/agent";

import { delayOf, lapsedAt, optionLinesOf } from "#agent/approval-details.ts";

const asked = DateTime.makeUnsafe("2026-11-22T08:00:00Z");

const answer: AgentMessage = {
  approvals: [],
  cards: [],
  createdAt: asked,
  durationMs: 1000,
  id: "m1",
  media: [],
  outcome: "awaitingApproval",
  rating: null,
  role: "assistant",
  skills: [],
  steps: [],
  text: "",
};

describe(optionLinesOf, () => {
  it("lists every option set, by name, its values as text, never the platform's tag", () => {
    expect(
      optionLinesOf({
        collaborators: ["synthetic.partner", "synthetic.friend"],
        mentions: [{ name: "Peal", urn: "urn:li:organization:1" }],
        platform: "instagram",
        shareToFeed: true,
        title: "Spring",
        trialReel: null,
      })
    ).toStrictEqual([
      {
        field: "collaborators",
        mediaId: null,
        value: "synthetic.partner, synthetic.friend",
      },
      {
        field: "mentions",
        mediaId: null,
        value: '[{"name":"Peal","urn":"urn:li:organization:1"}]',
      },
      { field: "shareToFeed", mediaId: null, value: "true" },
      { field: "title", mediaId: null, value: "Spring" },
    ]);
    // A file an option names is the file, to show as such.
    expect(
      optionLinesOf({ platform: "youtube", thumbnailMediaId: "media-9" })
    ).toStrictEqual([
      { field: "thumbnailMediaId", mediaId: "media-9", value: "media-9" },
    ]);
    expect(optionLinesOf(null)).toStrictEqual([]);
  });
});

describe(delayOf, () => {
  it("says a wait in the largest unit that says it exactly", () => {
    expect([90, 120, 7200, 86_400, 5].map(delayOf)).toStrictEqual([
      { unit: "second", value: 90 },
      { unit: "minute", value: 2 },
      { unit: "hour", value: 2 },
      { unit: "day", value: 1 },
      { unit: "second", value: 5 },
    ]);
  });
});

describe(lapsedAt, () => {
  it("lets an answer's changes lapse a day after it was written, once the time is known", () => {
    expect([
      lapsedAt(answer, null),
      lapsedAt(answer, DateTime.add(asked, { hours: 23 })),
      lapsedAt(answer, DateTime.add(asked, { hours: 25 })),
    ]).toStrictEqual([false, false, true]);
  });
});
