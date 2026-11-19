import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { AgendaItem } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  agendaDays,
  AgendaDaysView,
} from "#components/overview/overview-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (locale: "en" | "fr", view: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Paris"
    >
      {view}
    </NextIntlClientProvider>
  );

const link = (href: string, label: string) => <a href={href}>{label}</a>;

const workspace = { id: "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e31" };

const item = (
  postId: string,
  iso: string,
  extra: Partial<AgendaItem> = {}
): AgendaItem => ({
  excerpt: "A synthetic post",
  platforms: ["mastodon", "bluesky"],
  postId,
  scheduledAt: DateTime.makeUnsafe(iso),
  status: "scheduled",
  timeZone: "Europe/Paris",
  workspaceId: workspace.id,
  ...extra,
});

describe(agendaDays, () => {
  it("groups the posts by day as given, keeping their order", () => {
    const items = [
      item("0190f3a0-0000-7000-8000-000000000001", "2026-11-13T22:30:00Z"),
      item("0190f3a0-0000-7000-8000-000000000002", "2026-11-13T23:30:00Z"),
      item("0190f3a0-0000-7000-8000-000000000003", "2026-11-15T09:00:00Z"),
    ];

    // In Paris the second post goes out on the 14th.
    const days = agendaDays(items, ({ scheduledAt }) =>
      DateTime.formatIsoDate(
        DateTime.makeZonedUnsafe(scheduledAt, { timeZone: "Europe/Paris" })
      )
    );

    expect(
      days.map(({ day, items: listed }) => [day, listed.length])
    ).toStrictEqual([
      ["2026-11-13", 1],
      ["2026-11-14", 1],
      ["2026-11-15", 1],
    ]);
  });
});

describe(AgendaDaysView, () => {
  it("shows each post's time, workspace, platforms and text, linked to the post", async () => {
    const listed = item(
      "0190f3a0-0000-7000-8000-000000000001",
      "2026-11-13T08:00:00Z",
      {
        excerpt: "مرحبا synthetic",
        platforms: null,
        status: "awaitingApproval",
      }
    );

    const html = await render(
      "en",
      <AgendaDaysView
        days={[{ day: "Friday, November 13, 2026", items: [listed] }]}
        linkTo={link}
        workspaceNames={new Map([[workspace.id, "Studio"]])}
      />
    );

    expect(html).toMatch(
      /Friday, November 13, 2026.*Studio.*Waiting for approval/u
    );
    expect(html).toContain('dir="auto"');
    expect(html).toContain(
      `<a href="/${workspace.id}/posts/${listed.postId}">مرحبا synthetic</a>`
    );
    expect(html).not.toContain("mastodon");
  });

  it("names each platform in words", async () => {
    const html = await render(
      "en",
      <AgendaDaysView
        days={[
          {
            day: "Friday, November 13, 2026",
            items: [
              item(
                "0190f3a0-0000-7000-8000-000000000002",
                "2026-11-13T09:00:00Z",
                {
                  platforms: ["googleBusiness", "x"],
                }
              ),
            ],
          },
        ]}
        linkTo={link}
        workspaceNames={new Map([[workspace.id, "Studio"]])}
      />
    );

    expect(html).toContain("Google Business Profile");
    expect(html).not.toContain("googleBusiness");
  });
});
