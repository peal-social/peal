import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type {
  AnalyticsDashboard,
  AnalyticsSummary,
  SocialChannel,
  DashboardTotals,
  Platform,
  PostAnalytics,
} from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { workspaceFigures } from "#analytics/widgets.ts";
import { EngagementChart } from "#components/analytics/engagement-chart.tsx";
import {
  countedOn,
  PostMetricsView,
} from "#components/analytics/post-metrics.tsx";
import {
  ChannelsBody,
  ComparisonBody,
  DayCountBody,
  ExportBody,
  StatBody,
} from "#components/analytics/widgets/widget-bodies.tsx";
import { WidgetCardView } from "#components/analytics/widgets/widget-card.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (
  locale: "en" | "fr",
  view: ReactNode,
  timeZone = "UTC"
) => {
  const messages = await loadMessages(locale);

  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
    >
      {view}
    </NextIntlClientProvider>
  );
};

const channel: SocialChannel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "@alice@mastodon.test",
  id: "01900000-0000-7000-8000-0000000000c1",
  label: null,
  platform: "mastodon",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const summary: AnalyticsSummary = {
  channels: [
    {
      channelId: channel.id,
      impressions: null,
      likes: 1234,
      posts: 3,
      quotes: null,
      replies: 5,
      reposts: 42,
    },
    {
      channelId: "01900000-0000-7000-8000-0000000000c2",
      impressions: null,
      likes: 7,
      posts: 1,
      quotes: 2,
      replies: 0,
      reposts: 1,
    },
  ],
  days: [
    { date: "2026-11-08", likes: 10, quotes: 1, replies: 2, reposts: 3 },
    { date: "2026-11-09", likes: -1, quotes: 0, replies: 0, reposts: 0 },
  ],
  from: "2026-11-08",
  timeZone: "Europe/Paris",
  to: "2026-11-09",
  topPosts: [],
  totals: {
    impressions: null,
    likes: 1241,
    posts: 4,
    quotes: 2,
    replies: 5,
    reposts: 43,
  },
};

describe(EngagementChart, () => {
  it("offers the figures as a table beside the chart", async () => {
    const html = await render(
      "en",
      <EngagementChart days={summary.days} keys={["likes", "reposts"]} />
    );

    expect(html).toContain('aria-label="Show the engagement as"');
    expect(html).toContain(">Chart<");
    expect(html).toContain(">Table<");
    // The chart is hidden from screen readers, who take the table.
    expect(html).toMatch(/data-slot="chart"[^>]*aria-hidden="true"/u);
    expect(html).toContain(
      "Engagement gained each day, from Nov 8, 2026 to Nov 9, 2026."
    );
  });

  it("writes days as the calendar has them, whatever the zone", async () => {
    const html = await render(
      "fr",
      <EngagementChart days={summary.days} keys={["likes"]} />,
      "Pacific/Honolulu"
    );

    expect(html).toContain("du 8 nov. 2026 au 9 nov. 2026");
  });
});

const analytics: PostAnalytics = {
  postId: "01900000-0000-7000-8000-0000000000a1",
  targets: [
    {
      channelId: channel.id,
      collecting: true,
      lastCollectedAt: DateTime.makeUnsafe("2026-11-09T10:07:00.000Z"),
      latest: {
        clicks: null,
        impressions: null,
        likes: 12,
        quotes: 2,
        reach: null,
        replies: 4,
        reposts: 3,
        saves: null,
      },
      permalink: "https://mastodon.test/@alice/1",
      publishedAt: DateTime.makeUnsafe("2026-11-09T08:00:00.000Z"),
      snapshots: [],
      targetId: "01900000-0000-7000-8000-0000000000b1",
    },
    {
      channelId: "01900000-0000-7000-8000-0000000000c2",
      collecting: false,
      lastCollectedAt: null,
      latest: null,
      permalink: null,
      publishedAt: DateTime.makeUnsafe("2026-10-01T08:00:00.000Z"),
      snapshots: [],
      targetId: "01900000-0000-7000-8000-0000000000b2",
    },
  ],
};

// A platform as a server's capabilities describe its analytics.
const described = (platform: Platform, perPost: boolean) => ({
  analytics: { accountNumbers: [], perPost, postCounts: [] },
  platform,
});

describe(PostMetricsView, () => {
  it("gives each channel's latest counts", async () => {
    const html = await render(
      "en",
      <PostMetricsView
        analytics={analytics}
        channels={[channel]}
        publishedOn={[channel.id]}
      />
    );

    expect(html).toContain("@alice@mastodon.test");
    expect(html).toContain(">Likes<");
    expect(html).toContain(">12<");
    expect(html).toContain(">Quotes<");
    expect(html).not.toContain(">Impressions<");
  });

  it("says when they were read, in the reader's zone, and when no more", async () => {
    const html = await render(
      "en",
      <PostMetricsView
        analytics={analytics}
        channels={[channel]}
        publishedOn={[channel.id]}
      />,
      "Europe/Paris"
    );

    expect(html).toContain("Read Nov 9, 2026, 11:07 AM");
    expect(html).toContain("Not read yet");
    expect(html).toContain("No longer read: posts are followed for 30 days.");
  });

  it("says when counts come, before the first read", async () => {
    const html = await render(
      "fr",
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[channel]}
        publishedOn={[channel.id]}
      />
    );

    expect(html).toContain(
      "Peal relève pour l’instant les chiffres sur Mastodon, Bluesky, TikTok, YouTube, Instagram, Pinterest, les pages LinkedIn, Facebook, Threads et X, dans l’heure qui suit la parution."
    );
  });

  it("says counts are not available on the platforms Peal reads none on", async () => {
    const linkedin: SocialChannel = {
      ...channel,
      handle: "Alice Example",
      id: "01900000-0000-7000-8000-0000000000c3",
      label: null,
      platform: "linkedin",
    };

    // A location: Google gives no count of a post.
    const business: SocialChannel = {
      ...channel,
      handle: "Example Bakery",
      id: "01900000-0000-7000-8000-0000000000c4",
      label: null,
      platform: "googleBusiness",
    };

    const view = (
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[channel, linkedin, business]}
        publishedOn={[linkedin.id, business.id]}
      />
    );

    const english = await render("en", view);
    const french = await render("fr", view);

    expect(english).toContain(
      "Counts are not available on LinkedIn profiles and Google Business Profile: Peal reads them on Mastodon, Bluesky, TikTok, YouTube, Instagram, Pinterest, LinkedIn pages, Facebook, Threads, and X only, so far."
    );
    expect(english).not.toContain("within the hour");
    expect(french).toContain(
      "Les chiffres ne sont pas disponibles sur les profils LinkedIn et Google Business Profile : Peal ne les relève pour l’instant que sur Mastodon, Bluesky, TikTok, YouTube, Instagram, Pinterest, les pages LinkedIn, Facebook, Threads et X."
    );
    expect(french).not.toContain("dans l’heure");
  });

  it("follows the server for the platforms it reads: X only where its operator turned it on", async () => {
    const x: SocialChannel = {
      ...channel,
      handle: "@alice_example",
      id: "01900000-0000-7000-8000-0000000000c7",
      platform: "x",
    };

    // This server's capabilities: counts on Mastodon and Bluesky, none on X.
    const html = await render(
      "en",
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[channel, x]}
        counted={["mastodon", "bluesky"]}
        publishedOn={[x.id]}
      />
    );

    expect(html).toContain(
      "Counts are not available on X: Peal reads them on Mastodon and Bluesky only, so far."
    );
    expect(html).not.toContain("within the hour");

    // Where the operator turned X reads on, its counts are on their way.
    const reading = await render(
      "en",
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[channel, x]}
        counted={["mastodon", "bluesky", "x"]}
        publishedOn={[x.id]}
      />
    );

    expect(reading).toContain(
      "Peal reads counts on Mastodon, Bluesky, and X so far, within the hour after a post goes live."
    );
    expect(reading).not.toContain("not available");
  });

  it("tells the platforms a server counts from its capabilities", () => {
    expect(
      countedOn([
        described("mastodon", true),
        described("x", false),
        described("linkedin", true),
      ])
    ).toStrictEqual(["mastodon", "linkedin"]);
  });

  it("promises counts on TikTok and YouTube, which Peal reads", async () => {
    const tiktok: SocialChannel = {
      ...channel,
      handle: "@alice_example",
      id: "01900000-0000-7000-8000-0000000000c5",
      label: null,
      platform: "tiktok",
    };

    const youtube: SocialChannel = {
      ...channel,
      handle: "Alice Example",
      id: "01900000-0000-7000-8000-0000000000c6",
      label: null,
      platform: "youtube",
    };

    const html = await render(
      "en",
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[tiktok, youtube]}
        publishedOn={[tiktok.id, youtube.id]}
      />
    );

    expect(html).toContain("within the hour after a post goes live");
    expect(html).not.toContain("Counts are not available");
  });

  it("promises counts on a LinkedIn page, which Peal reads", async () => {
    const page: SocialChannel = {
      ...channel,
      connection: "linkedinPage",
      handle: "example-bakery",
      id: "01900000-0000-7000-8000-0000000000c7",
      label: null,
      platform: "linkedin",
    };

    const html = await render(
      "en",
      <PostMetricsView
        analytics={{ postId: analytics.postId, targets: [] }}
        channels={[page]}
        publishedOn={[page.id]}
      />
    );

    expect(html).toContain("within the hour after a post goes live");
    expect(html).not.toContain("Counts are not available");
  });

  it("says so beside the counts of the channels Peal reads", async () => {
    const linkedin: SocialChannel = {
      ...channel,
      handle: "Alice Example",
      id: "01900000-0000-7000-8000-0000000000c3",
      label: null,
      platform: "linkedin",
    };

    const html = await render(
      "en",
      <PostMetricsView
        analytics={analytics}
        channels={[channel, linkedin]}
        publishedOn={[channel.id, linkedin.id]}
      />
    );

    expect(html).toContain(">12<");
    expect(html).toContain("Counts are not available on LinkedIn profiles:");
  });
});

const totalsOf = (likes: number): DashboardTotals => ({
  clicks: null,
  engagement: likes + 2,
  impressions: null,
  likes,
  posts: 3,
  quotes: null,
  reach: null,
  replies: 1,
  reposts: 1,
  saves: null,
});

const numbers = {
  followers: { current: 1250, gained: 30 },
  previousFollowers: { current: 1220, gained: -4 },
  previousKept: true,
  previousTotals: totalsOf(8),
  totals: totalsOf(12),
};

const dashboard: AnalyticsDashboard = {
  ...numbers,
  channels: [
    { ...numbers, channelId: channel.id, platform: "mastodon" },
    {
      ...numbers,
      channelId: "01900000-0000-7000-8000-0000000000c9",
      followers: { current: null, gained: null },
      platform: null,
    },
  ],
  days: [
    {
      date: "2026-11-08",
      followers: null,
      likes: 0,
      quotes: 0,
      reach: null,
      replies: 0,
      reposts: 0,
      views: null,
    },
    {
      date: "2026-11-09",
      followers: 1250,
      likes: 4,
      quotes: 0,
      reach: 300,
      replies: 0,
      reposts: 0,
      views: 420,
    },
  ],
  from: "2026-11-08",
  platforms: [{ ...numbers, platform: "mastodon" }],
  previous: { from: "2026-11-06", to: "2026-11-07" },
  timeZone: "Europe/Paris",
  to: "2026-11-09",
  topPosts: [],
};

const figures = workspaceFigures(dashboard);

describe(WidgetCardView, () => {
  it("names the widget in a heading, with its period under it", async () => {
    const html = await render(
      "en",
      <WidgetCardView name="Followers" size="small" subtitle="Last 30 days">
        <p>body</p>
      </WidgetCardView>
    );

    expect(html).toMatch(/<article aria-labelledby="[^"]+"/u);
    expect(html).toContain(">Followers</h2>");
    expect(html).toContain(">Last 30 days<");
    expect(html).toContain("col-span-1");
  });
});

describe(DayCountBody, () => {
  it("shows followers with what they gained, and their line", async () => {
    const html = await render(
      "en",
      <DayCountBody count="followers" figures={figures} name="Followers" />
    );

    expect(html).toContain(">1,250<");
    expect(html).toContain("30 more over the range");
    // The line is hidden from screen readers, who take its table.
    expect(html).toMatch(/data-slot="chart"[^>]*aria-hidden="true"/u);
    expect(html).toContain("Followers, day by day");
    // The day nothing was read says so.
    expect(html).toContain("Not given by the platform");
  });

  it("shows the engagement against the period before", async () => {
    const html = await render(
      "en",
      <DayCountBody count="engagement" figures={figures} name="Engagement" />
    );

    // 14 interactions against 10: 4 more, 40%.
    expect(html).toContain(">14<");
    expect(html).toContain("4 more (+40%)");
  });

  it("shows no change against a range before that a platform no longer keeps", async () => {
    const html = await render(
      "en",
      <DayCountBody
        count="engagement"
        figures={{ ...figures, previousKept: false }}
        name="Engagement"
      />
    );

    expect(html).toContain(
      "No comparison: a platform’s terms keep its figures for less than the range before goes back"
    );
    expect(html).not.toContain("4 more (+40%)");
  });

  it("adds up the accounts' views over the days", async () => {
    const html = await render(
      "en",
      <DayCountBody count="views" figures={figures} name="Account views" />
    );

    expect(html).toContain(">420<");
    expect(html).toContain("Over 2 days");
  });

  it("says when nothing was read, with no line", async () => {
    const html = await render(
      "fr",
      <DayCountBody
        count="followers"
        figures={{
          ...figures,
          days: figures.days.map((day) => ({ ...day, followers: null })),
          followers: { current: null, gained: null },
        }}
        name="Abonnés"
      />
    );

    expect(html).toContain("Rien n’a encore été lu sur cette période.");
    expect(html).not.toContain('data-slot="chart"');
  });
});

describe(StatBody, () => {
  it("shows a total with its trend and each platform's share", async () => {
    const html = await render(
      "en",
      <StatBody count="posts" figures={figures} />
    );

    expect(html).toContain(">3<");
    expect(html).toContain("No change");
    expect(html).toContain("Mastodon");
  });

  it("says a count no platform gives, never zero, with no trend", async () => {
    const html = await render(
      "en",
      <StatBody count="impressions" figures={figures} />
    );

    expect(html).toContain("Not given by the platform");
    expect(html).not.toContain("No change");
    expect(html).not.toContain(">0<");
  });
});

describe(ComparisonBody, () => {
  it("puts the range's totals beside the range before", async () => {
    const html = await render("en", <ComparisonBody figures={figures} />);

    expect(html).toContain("4 more (+40%)");
    // Unknown is written once in its tile, never as zero.
    expect(html).not.toMatch(
      /<dd[^>]*>(?:(?!<\/dd>).)*Not given by the platform(?:(?!<\/dd>).)*Not given by the platform/su
    );
  });
});

describe(ChannelsBody, () => {
  it("names each channel, one no longer connected too", async () => {
    const html = await render(
      "en",
      <ChannelsBody channels={[channel]} dashboard={dashboard} />
    );

    expect(html).toContain("@alice@mastodon.test");
    expect(html).toContain("A channel no longer connected");
    expect(html).toContain(">1,250<");
    expect(html).toContain(
      "The latest counts of the range’s posts, by channel"
    );
  });
});

describe(ExportBody, () => {
  it("links both files", async () => {
    const html = await render(
      "fr",
      <ExportBody accounts="/export?kind=accounts" posts="/export?kind=posts" />
    );

    expect(html).toContain('href="/export?kind=posts"');
    expect(html).toContain('href="/export?kind=accounts"');
  });
});
