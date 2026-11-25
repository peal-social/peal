import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration } from "effect";
import { postCountsReadForDays } from "peal-contract";
import type {
  PostTarget,
  SocialChannel,
  TargetMetrics,
  TargetOptions,
} from "peal-contract";

import {
  countsRowsOf,
  firstReadWithin,
  postCountsWindow,
} from "#analytics/post-counts.ts";

const now = DateTime.makeUnsafe("2026-11-25T12:00:00Z");

const ago = (duration: Duration.Duration) =>
  DateTime.subtractDuration(now, duration);

const channel = (
  id: string,
  platform: SocialChannel["platform"],
  connection: SocialChannel["connection"] = null
): SocialChannel => ({
  avatarUrl: null,
  connection,
  displayName: null,
  handle: `@${id}@social.example`,
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

const target = (
  id: string,
  channelId: string,
  fields: Partial<PostTarget> = {}
): PostTarget => ({
  channelId,
  editedAt: null,
  failureReason: null,
  id,
  options: null,
  parts: { count: 1, live: [] },
  permalink: null,
  publishedAt: ago(Duration.days(1)),
  removedAt: null,
  round: 1,
  status: "published",
  unconfirmedReason: null,
  ...fields,
});

const tracked = (
  targetId: string,
  channelId: string,
  fields: Partial<TargetMetrics> = {}
): TargetMetrics => ({
  channelId,
  collecting: true,
  lastCollectedAt: null,
  latest: null,
  permalink: null,
  publishedAt: ago(Duration.days(1)),
  snapshots: [],
  targetId,
  ...fields,
});

const counts = {
  clicks: null,
  impressions: null,
  likes: 3,
  quotes: null,
  reach: null,
  replies: 0,
  reposts: 1,
  saves: null,
};

const mastodon = channel("c1", "mastodon");

// One target's row, as the page draws it, on a server that reads counts
// on Mastodon and LinkedIn pages, or whose capabilities could not be read
// (`unknown`).
const rowOf = (
  shown: PostTarget,
  follows: readonly TargetMetrics[],
  channels: readonly SocialChannel[] = [mastodon],
  platforms: readonly SocialChannel["platform"][] | "unknown" = [
    "mastodon",
    "linkedin",
  ]
) =>
  countsRowsOf({
    analytics: { postId: "p1", targets: follows },
    channels,
    counted: platforms === "unknown" ? undefined : platforms,
    now,
    targets: [shown],
  })[0]?.state;

describe(countsRowsOf, () => {
  it("reads the window from the contract", () => {
    expect(Duration.toDays(postCountsWindow)).toBe(postCountsReadForDays);
  });

  it("gives a channel's counts once read, still read or not", () => {
    const read = tracked("t1", "c1", {
      lastCollectedAt: ago(Duration.hours(2)),
      latest: counts,
    });

    expect(rowOf(target("t1", "c1"), [read])).toStrictEqual({
      _tag: "read",
      ended: undefined,
      tracked: read,
    });
  });

  it("names the 30 days only for a post older than them", () => {
    const old = tracked("t1", "c1", {
      collecting: false,
      lastCollectedAt: ago(Duration.days(40)),
      latest: counts,
      publishedAt: ago(Duration.days(41)),
    });

    expect(rowOf(target("t1", "c1"), [old])).toMatchObject({
      ended: "window",
    });

    // A day-old post no longer read ended for another reason.
    const young = tracked("t1", "c1", {
      collecting: false,
      lastCollectedAt: ago(Duration.hours(20)),
      latest: counts,
    });

    expect(rowOf(target("t1", "c1"), [young])).toMatchObject({
      ended: "other",
    });
  });

  it("says a post removed from the platform is no longer read for that", () => {
    const removed = tracked("t1", "c1", {
      collecting: false,
      latest: counts,
    });

    expect(
      rowOf(target("t1", "c1", { removedAt: ago(Duration.hours(3)) }), [
        removed,
      ])
    ).toMatchObject({ ended: "removed" });
  });

  it("says a channel that left the workspace ended the reads", () => {
    const gone = tracked("t1", "c1", { collecting: false, latest: counts });

    expect(rowOf(target("t1", "c1"), [gone], [])).toMatchObject({
      ended: "disconnected",
    });
  });

  it("says no longer read, and promises nothing, when the reads ended before the first", () => {
    const ended = tracked("t1", "c1", {
      collecting: false,
      publishedAt: ago(Duration.minutes(20)),
    });

    expect(
      rowOf(target("t1", "c1", { removedAt: ago(Duration.minutes(5)) }), [
        ended,
      ])
    ).toStrictEqual({ _tag: "ended", reason: "removed" });
  });

  it("says counts come while the post is fresh, and not after", () => {
    const fresh = target("t1", "c1", {
      publishedAt: ago(Duration.minutes(10)),
    });

    expect(rowOf(fresh, [])).toStrictEqual({ _tag: "toCome" });
    expect(
      rowOf(fresh, [
        tracked("t1", "c1", { publishedAt: ago(Duration.minutes(10)) }),
      ])
    ).toStrictEqual({ _tag: "toCome" });

    const late = target("t1", "c1", {
      publishedAt: DateTime.subtractDuration(
        ago(firstReadWithin),
        Duration.minutes(1)
      ),
    });

    // Analytics never followed it: it never will.
    expect(rowOf(late, [])).toStrictEqual({ _tag: "none" });
    // Followed, and not read yet: the next run may still.
    expect(rowOf(late, [tracked("t1", "c1")])).toStrictEqual({
      _tag: "noneYet",
    });
  });

  it("tells a platform Peal reads no counts on, by the server's word", () => {
    const x = channel("c2", "x");
    const profile = channel("c3", "linkedin", "linkedinProfile");
    const location = channel("c4", "googleBusiness");

    expect(rowOf(target("t2", "c2"), [], [x])).toStrictEqual({
      _tag: "uncounted",
      platform: "x",
    });
    expect(rowOf(target("t3", "c3"), [], [profile])).toStrictEqual({
      _tag: "uncounted",
      platform: "linkedin",
    });
    expect(rowOf(target("t4", "c4"), [], [location])).toStrictEqual({
      _tag: "uncounted",
      platform: "googleBusiness",
    });
  });

  it("promises nothing the server did not confirm when its capabilities could not be read", () => {
    const fresh = target("t1", "c1", {
      publishedAt: ago(Duration.minutes(10)),
    });

    expect(rowOf(fresh, [], [mastodon], "unknown")).toStrictEqual({
      _tag: "noneYet",
    });

    // A platform Peal has no reader for is known without them.
    const location = channel("c4", "googleBusiness");

    expect(rowOf(target("t4", "c4"), [], [location], "unknown")).toStrictEqual({
      _tag: "uncounted",
      platform: "googleBusiness",
    });
  });

  it("says a story has no counts", () => {
    const instagram = channel("c5", "instagram");
    const options: TargetOptions = { format: "story", platform: "instagram" };

    expect(
      rowOf(
        target("t5", "c5", {
          options,
          publishedAt: ago(Duration.minutes(10)),
        }),
        [],
        [instagram],
        ["instagram"]
      )
    ).toStrictEqual({ _tag: "story" });
  });

  it("leaves out a channel the post did not go out on", () => {
    expect(
      countsRowsOf({
        analytics: { postId: "p1", targets: [] },
        channels: [mastodon],
        counted: ["mastodon"],
        now,
        targets: [target("t1", "c1", { status: "failed" })],
      })
    ).toStrictEqual([]);
  });

  it("keeps a channel analytics follows whose later part failed", () => {
    const read = tracked("t1", "c1", { latest: counts });

    expect(
      countsRowsOf({
        analytics: { postId: "p1", targets: [read] },
        channels: [mastodon],
        counted: ["mastodon"],
        now,
        targets: [target("t1", "c1", { status: "failed" })],
      }).map(({ state }) => state._tag)
    ).toStrictEqual(["read"]);
  });
});
