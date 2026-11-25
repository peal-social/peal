import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type {
  Platform,
  PostAnalytics,
  PostTarget,
  SocialChannel,
  TargetMetrics,
  TargetOptions,
} from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import {
  countedOn,
  PostMetricsView,
} from "#components/analytics/post-metrics.tsx";
import { readingLines } from "#components/analytics/readings-chart.tsx";
import { loadMessages } from "#i18n/messages.ts";

// Every case reads at one instant, in one zone, whatever the machine's.
const now = DateTime.makeUnsafe("2026-11-25T12:00:00Z");

const ago = (duration: Duration.Duration) =>
  DateTime.subtractDuration(now, duration);

const channel = (
  id: string,
  handle: string,
  platform: Platform,
  connection: SocialChannel["connection"] = null
): SocialChannel => ({
  avatarUrl: null,
  connection,
  displayName: null,
  handle,
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

const mastodon = channel("c1", "@alice@mastodon.test", "mastodon");
const bluesky = channel("c2", "alice.bsky.test", "bluesky");
const profile = channel("c3", "Alice Example", "linkedin", "linkedinProfile");
const instagram = channel("c4", "@alice_example", "instagram");
const x = channel("c5", "@alice_example", "x");

// The page names a channel with its platform, as its cards do.
const named = (channelId: string | undefined) => {
  const found = [mastodon, bluesky, profile, instagram, x].find(
    ({ id }) => id === channelId
  );

  return found === undefined
    ? "A disconnected channel"
    : `${found.handle} on ${found.platform}`;
};

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

const counts = {
  clicks: null,
  impressions: null,
  likes: 12,
  quotes: 2,
  reach: null,
  replies: 4,
  reposts: 3,
  saves: null,
};

const read = (fields: Partial<TargetMetrics> = {}): TargetMetrics => ({
  channelId: mastodon.id,
  collecting: true,
  lastCollectedAt: DateTime.makeUnsafe("2026-11-25T11:07:00Z"),
  latest: counts,
  permalink: "https://mastodon.test/@alice/1",
  publishedAt: ago(Duration.days(1)),
  snapshots: [
    { collectedAt: ago(Duration.hours(20)), metrics: { ...counts, likes: 4 } },
    { collectedAt: ago(Duration.hours(1)), metrics: counts },
  ],
  targetId: "t1",
  ...fields,
});

const render = async (
  {
    analytics,
    counted = ["mastodon", "bluesky", "instagram", "linkedin"],
    targets,
  }: {
    readonly analytics: PostAnalytics;
    // `unknown`: the server's capabilities could not be read.
    readonly counted?: readonly Platform[] | "unknown";
    readonly targets: readonly PostTarget[];
  },
  locale: "en" | "fr" = "en"
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Paris"
    >
      <PostMetricsView
        analytics={analytics}
        channelName={named}
        channels={[mastodon, bluesky, profile, instagram, x]}
        counted={counted === "unknown" ? undefined : counted}
        now={now}
        targets={targets}
      />
    </NextIntlClientProvider>
  );

const followed = (targets: readonly TargetMetrics[]): PostAnalytics => ({
  postId: "p1",
  targets,
});

describe(PostMetricsView, () => {
  it("names each row's channel with its platform, as a heading", async () => {
    const html = await render({
      analytics: followed([read()]),
      targets: [target("t1", "c1")],
    });

    expect(html).toContain("<h3");
    expect(html).toContain(">@alice@mastodon.test on mastodon</h3>");
    expect(html).toContain(">12<");
  });

  it("says when the counts were read, in the reader's zone", async () => {
    const html = await render({
      analytics: followed([read()]),
      targets: [target("t1", "c1")],
    });

    expect(html).toContain("Read Nov 25, 2026, 12:07 PM");
    expect(html).not.toContain("No longer read");
  });

  it("gives the 30 days only for a post older than them", async () => {
    const html = await render({
      analytics: followed([
        read({
          collecting: false,
          publishedAt: ago(Duration.days(45)),
        }),
      ]),
      targets: [target("t1", "c1", { publishedAt: ago(Duration.days(45)) })],
    });

    expect(html).toContain(
      "No longer read. Peal reads a post’s counts for 30 days after it goes live."
    );
  });

  it("says a post removed from the platform is no longer read, never for its 30 days", async () => {
    const html = await render({
      analytics: followed([read({ collecting: false })]),
      targets: [target("t1", "c1", { removedAt: ago(Duration.hours(5)) })],
    });

    expect(html).toContain(
      "No longer read. The post was removed from the platform."
    );
    expect(html).not.toContain("30 days");
  });

  it("says a disconnected channel ended the reads", async () => {
    const html = await render({
      analytics: followed([read({ channelId: "c9", collecting: false })]),
      targets: [target("t1", "c9")],
    });

    expect(html).toContain(">A disconnected channel</h3>");
    expect(html).toContain("No longer read. Its channel was disconnected.");
  });

  it("says no longer read alone when the reads ended before the first", async () => {
    const html = await render({
      analytics: followed([
        read({
          collecting: false,
          lastCollectedAt: null,
          latest: null,
          publishedAt: ago(Duration.minutes(30)),
          snapshots: [],
        }),
      ]),
      targets: [
        target("t1", "c1", {
          publishedAt: ago(Duration.minutes(30)),
          removedAt: ago(Duration.minutes(10)),
        }),
      ],
    });

    expect(html).toContain("No longer read.");
    expect(html).not.toContain("within the hour");
    expect(html).not.toContain("Not read yet");
  });

  it("says counts come within the hour on a channel just published, without the 30 days or a list", async () => {
    const html = await render({
      analytics: followed([read()]),
      targets: [
        target("t1", "c1"),
        target("t2", "c2", { publishedAt: ago(Duration.minutes(5)) }),
      ],
    });

    expect(html).toContain(">alice.bsky.test on bluesky</h3>");
    expect(html).toContain("Not read yet");
    expect(html).toContain(
      "Counts come within the hour after the post goes live."
    );
    expect(html).not.toContain("30 days");
    expect(html).not.toContain("TikTok");
  });

  it("promises nothing on a channel past its first hours that analytics never followed", async () => {
    const html = await render({
      analytics: followed([]),
      targets: [target("t2", "c2", { publishedAt: ago(Duration.hours(6)) })],
    });

    expect(html).toContain("Peal has no counts for this post on this channel.");
    expect(html).not.toContain("within the hour");
  });

  it("says on its own row that a LinkedIn profile gives no counts", async () => {
    const html = await render({
      analytics: followed([read()]),
      targets: [target("t1", "c1"), target("t3", "c3")],
    });

    expect(html).toContain(">Alice Example on linkedin</h3>");
    expect(html).toContain(
      "LinkedIn gives Peal no counts for a profile’s posts."
    );
  });

  it("says this server reads no counts on X where its operator left them off", async () => {
    const html = await render({
      analytics: followed([]),
      targets: [target("t5", "c5", { publishedAt: ago(Duration.minutes(5)) })],
    });

    expect(html).toContain("This server doesn’t read counts on X.");
  });

  it("says a story has no counts", async () => {
    const options: TargetOptions = { format: "story", platform: "instagram" };

    const html = await render({
      analytics: followed([]),
      targets: [
        target("t4", "c4", {
          options,
          publishedAt: ago(Duration.minutes(5)),
        }),
      ],
    });

    expect(html).toContain(
      "Stories disappear after 24 hours and have no statistics in Peal."
    );
    expect(html).not.toContain("within the hour");
  });

  it("promises no count when the server's capabilities could not be read", async () => {
    const html = await render({
      analytics: followed([]),
      counted: "unknown",
      targets: [target("t2", "c2", { publishedAt: ago(Duration.minutes(5)) })],
    });

    expect(html).toContain("No counts have been read yet.");
    expect(html).not.toContain("within the hour");
  });

  it("shows nothing of a channel the post did not go out on", async () => {
    const html = await render({
      analytics: followed([]),
      targets: [target("t2", "c2", { status: "failed" })],
    });

    expect(html).toBe("");
  });

  it("says when they were read in the reader's language", async () => {
    const french = await render(
      { analytics: followed([read()]), targets: [target("t1", "c1")] },
      "fr"
    );

    expect(french).toContain("Relevée le 25 nov. 2026");
  });
});

describe("the readings chart's lines", () => {
  it("are never lavender or yellow, and three of four are dashed", () => {
    const lines = Object.values(readingLines);

    expect(lines.map(({ color }) => color)).not.toContain("var(--chart-2)");
    expect(lines.map(({ color }) => color)).not.toContain("var(--chart-3)");
    expect(lines.filter(({ dash }) => dash !== "none")).toHaveLength(3);
  });
});

// A platform as a server's capabilities describe its analytics.
const described = (platform: Platform, perPost: boolean) => ({
  analytics: { accountNumbers: [], perPost, postCounts: [] },
  platform,
});

describe(countedOn, () => {
  it("tells the platforms a server counts from its capabilities", () => {
    expect(
      countedOn([
        described("mastodon", true),
        described("x", false),
        described("linkedin", true),
      ])
    ).toStrictEqual(["mastodon", "linkedin"]);
  });
});
