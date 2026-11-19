import { describe, expect, it } from "@effect/vitest";

import {
  everyThread,
  knownThreadFilter,
  threadFilterOf,
  threadQueryOf,
} from "#inbox/thread-query.ts";

const filterOf = (query: string) => threadFilterOf(new URLSearchParams(query));

describe(threadFilterOf, () => {
  it("reads the view and the channel, and every thread from what it does not know", () => {
    expect([
      filterOf("view=unanswered&channel=c1"),
      filterOf("view=later&channel="),
    ]).toStrictEqual([{ channelId: "c1", unanswered: true }, everyThread]);
  });
});

describe(threadQueryOf, () => {
  it("leaves the defaults out, and reads back what it writes", () => {
    const written = threadQueryOf({ channelId: "c1", unanswered: true });

    expect([
      written,
      threadQueryOf(everyThread),
      filterOf(written),
    ]).toStrictEqual([
      "view=unanswered&channel=c1",
      "",
      { channelId: "c1", unanswered: true },
    ]);
  });
});

describe(knownThreadFilter, () => {
  it("drops a channel the inbox does not read, and keeps the view", () => {
    expect([
      knownThreadFilter({ channelId: "gone", unanswered: true }, ["c1"]),
      knownThreadFilter({ channelId: "c1", unanswered: false }, ["c1"]),
    ]).toStrictEqual([
      { channelId: null, unanswered: true },
      { channelId: "c1", unanswered: false },
    ]);
  });
});
