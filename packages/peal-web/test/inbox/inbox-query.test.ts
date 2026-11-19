import { describe, expect, it } from "@effect/vitest";

import {
  defaultInbox,
  inboxQueryOf,
  inboxStateOf,
  knownThreadFilter,
  withInboxQuery,
} from "#inbox/inbox-query.ts";

const stateOf = (query: string) => inboxStateOf(new URLSearchParams(query));

describe(inboxStateOf, () => {
  it("reads the tab and the comments' filters, and the default from what it does not know", () => {
    expect([
      stateOf("view=reviews&status=waiting&channel=c1"),
      stateOf("view=later&status=all&channel="),
    ]).toStrictEqual([
      { filter: { channelId: "c1", unanswered: true }, view: "reviews" },
      defaultInbox,
    ]);
  });
});

describe(inboxQueryOf, () => {
  it("leaves the defaults out, and reads back what it writes", () => {
    const state = {
      filter: { channelId: "c1", unanswered: true },
      view: "messages",
    } as const;

    const written = inboxQueryOf(state);

    expect([
      written,
      inboxQueryOf(defaultInbox),
      stateOf(written),
      withInboxQuery("/w/inbox/t1", state),
      withInboxQuery("/w/inbox/t1", defaultInbox),
    ]).toStrictEqual([
      "view=messages&status=waiting&channel=c1",
      "",
      state,
      "/w/inbox/t1?view=messages&status=waiting&channel=c1",
      "/w/inbox/t1",
    ]);
  });
});

describe(knownThreadFilter, () => {
  it("drops a channel the inbox does not read, and keeps the status", () => {
    expect([
      knownThreadFilter({ channelId: "gone", unanswered: true }, ["c1"]),
      knownThreadFilter({ channelId: "c1", unanswered: false }, ["c1"]),
    ]).toStrictEqual([
      { channelId: null, unanswered: true },
      { channelId: "c1", unanswered: false },
    ]);
  });
});
