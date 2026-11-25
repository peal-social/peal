import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";

import { renderWeeklyDigest } from "../src/index.ts";
import type { Locale, WeeklyDigestEmail } from "../src/index.ts";

const utc = (iso: string) => DateTime.makeUnsafe(iso);

type LinkedDigestWorkspace = WeeklyDigestEmail["workspaces"][number];

const week = {
  from: utc("2026-11-09T00:00:00Z"),
  to: utc("2026-11-16T00:00:00Z"),
  until: utc("2026-11-23T00:00:00Z"),
};

const studio: LinkedDigestWorkspace = {
  calendarUrl: "https://app.example.test/2f9a/calendar",
  counts: {
    awaitingApproval: 1,
    failed: 1,
    scheduled: 6,
    unconfirmed: 0,
    wentOut: 7,
  },
  engagement: Option.some({ engagement: 1234, impressions: Option.none() }),
  name: "Studio <Nord> & Co",
  planned: [
    { at: utc("2026-11-17T08:00:00Z"), excerpt: "Launch day <b>soon</b>" },
  ],
  wentOut: [
    { at: utc("2026-11-10T09:30:00Z"), excerpt: "Autumn sale" },
    { at: utc("2026-11-11T09:30:00Z"), excerpt: "" },
  ],
};

const email = (locale: Locale, workspaces = [studio]): WeeklyDigestEmail => ({
  calendarUrl: "https://app.example.test/2f9a/calendar",
  locale,
  preferencesUrl: "https://app.example.test/2f9a/settings/notifications",
  week,
  workspaces,
});

describe(renderWeeklyDigest, () => {
  it("counts a workspace's week and names its first posts, in UTC", async () => {
    const { subject, text } = await renderWeeklyDigest(email("en"));

    expect(subject).toBe(
      "Your week on Peal: November 9, 2026 to November 15, 2026"
    );
    expect(
      [
        "What went out from November 9, 2026 to November 15, 2026, and what is planned until November 22, 2026",
        "7 posts went out · 1 failed · 6 scheduled this week · 1 waiting for approval",
        "- November 10, 2026 at 9:30 AM UTC: Autumn sale",
        "- November 11, 2026 at 9:30 AM UTC: No text",
        "- and 5 more",
        "Engagement with the week’s posts, as last counted: 1,234.",
        "Open the calendar of Studio <Nord> & Co: https://app.example.test/2f9a/calendar",
        "turn it off in your notification preferences (https://app.example.test/2f9a/settings/notifications).",
      ].filter((expected) => !text.includes(expected))
    ).toStrictEqual([]);
    expect(text).not.toContain("Impressions");
  });

  it("escapes what members wrote in its HTML, and links how to stop it", async () => {
    const { html } = await renderWeeklyDigest(email("en"));

    expect(html).toContain("Studio &lt;Nord&gt; &amp; Co");
    expect(html).toContain("Launch day &lt;b&gt;soon&lt;/b&gt;");
    expect(html).not.toContain("<b>soon</b>");
    expect(html).toMatch(
      /<a href="https:\/\/app\.example\.test\/2f9a\/settings\/notifications" [^>]*>your notification preferences<\/a>/u
    );
    expect(html).toContain('href="https://app.example.test/2f9a/calendar"');
  });

  it("is written in French, with French plurals", async () => {
    const { subject, text } = await renderWeeklyDigest(
      email("fr", [
        {
          ...studio,
          counts: { ...studio.counts, failed: 0, unconfirmed: 2, wentOut: 1 },
          engagement: Option.some({
            engagement: 1234,
            impressions: Option.some(56_789),
          }),
          wentOut: [studio.wentOut[0] ?? studio.planned[0]].flatMap((post) =>
            post === undefined ? [] : [post]
          ),
        },
      ])
    );

    expect(subject).toBe(
      "Votre semaine sur Peal : du 9 novembre 2026 au 15 novembre 2026"
    );
    expect(text).toContain(
      "1 publication partie · 2 à vérifier sur leurs plateformes · 6 programmées cette semaine · 1 en attente d’approbation"
    );
    expect(text).toContain("Impressions : 56 789.");
    expect(text).toContain(
      "désactivez-le dans vos préférences de notification"
    );
  });
});
