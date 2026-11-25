import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import type {
  AnalyticsDashboard,
  AnalyticsSummary,
  SocialChannel,
  DashboardTotals,
} from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { workspaceFigures } from "#analytics/widgets.ts";
import { EngagementChart } from "#components/analytics/engagement-chart.tsx";
import {
  ChannelsBody,
  ComparisonBody,
  DayCountBody,
  ExportBody,
  PostsRingBody,
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

const room = { height: 1, width: 1 } as const;

describe(WidgetCardView, () => {
  it("names the widget in a heading, with its period under it", async () => {
    const html = await render(
      "en",
      <WidgetCardView
        name="Followers"
        width={1}
        height={2}
        subtitle="Last 30 days"
      >
        <p>body</p>
      </WidgetCardView>
    );

    expect(html).toMatch(/<article aria-labelledby="[^"]+"/u);
    expect(html).toContain(">Followers</h2>");
    expect(html).toContain(">Last 30 days<");
    expect(html).toContain("col-span-1");
    expect(html).toContain("row-span-2");
  });
});

describe(DayCountBody, () => {
  it("shows followers with what they gained, and their line", async () => {
    const html = await render(
      "en",
      <DayCountBody
        room={room}
        count="followers"
        figures={figures}
        name="Followers"
      />
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
      <DayCountBody
        room={room}
        count="engagement"
        figures={figures}
        name="Engagement"
      />
    );

    // 14 interactions against 10: 4 more, 40%.
    expect(html).toContain(">14<");
    expect(html).toContain("4 more (+40%)");
  });

  it("shows no change against a range before that a platform no longer keeps", async () => {
    const html = await render(
      "en",
      <DayCountBody
        room={room}
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
      <DayCountBody
        room={room}
        count="views"
        figures={figures}
        name="Account views"
      />
    );

    expect(html).toContain(">420<");
    expect(html).toContain("Over 2 days");
  });

  it("says when nothing was read, with no line", async () => {
    const html = await render(
      "fr",
      <DayCountBody
        room={room}
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

describe(PostsRingBody, () => {
  it("rings the posts by platform, the total in its middle", async () => {
    const html = await render(
      "en",
      <PostsRingBody figures={figures} room={room} />
    );

    expect(html).toContain(">3<");
    expect(html).toContain("No change");
    expect(html).toContain("Mastodon");
  });
});

describe(StatBody, () => {
  it("says a count no platform gives, never zero, with no trend", async () => {
    const html = await render(
      "en",
      <StatBody room={room} count="impressions" figures={figures} />
    );

    expect(html).toContain("Not given by the platform");
    expect(html).not.toContain("No change");
    expect(html).not.toContain(">0<");
  });
});

describe(ComparisonBody, () => {
  it("puts the range's totals beside the range before", async () => {
    const html = await render(
      "en",
      <ComparisonBody room={room} figures={figures} />
    );

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
      <ChannelsBody room={room} channels={[channel]} dashboard={dashboard} />
    );

    expect(html).toContain("@alice@mastodon.test");
    expect(html).toContain("A channel no longer connected");
    expect(html).toContain(">1,250<");
    expect(html).toContain(">+30<");
    expect(html).toContain(
      "The latest counts of the range’s posts, by channel"
    );
  });
});

describe(ExportBody, () => {
  it("offers both files as buttons, as a link cannot name the workspace", async () => {
    const html = await render("fr", <ExportBody onDownload={() => {}} />);

    expect(html).toContain("Publications de la période");
    expect(html).toContain("Comptes, jour par jour");
    expect(html).not.toContain("href=");
  });
});
