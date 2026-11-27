import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import type { ArticleSummary, Channel } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CalendarArticleChip } from "#components/posts/calendar-article-chip.tsx";
import type { ViewLink } from "#components/posts/calendar-toolbar.tsx";
import { loadMessages } from "#i18n/messages.ts";

const PlainLink: ViewLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const site: Channel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "journal.example",
  id: "00000000-0000-7000-8000-00000000c0a1",
  label: "Synthetic Journal",
  platform: "wordpress",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const at = DateTime.makeUnsafe("2026-12-03T08:30:00Z");

const article: ArticleSummary = {
  authorId: null,
  categories: [],
  channelId: site.id,
  coverMediaId: null,
  createdAt: at,
  excerpt: null,
  id: "00000000-0000-7000-8000-0000000000a1",
  siteStatus: "publish",
  state: { _tag: "scheduled", scheduledAt: at, timeZone: "Europe/Paris" },
  tags: [],
  title: "Spring sowing",
  updatedAt: at,
};

const render = async (locale: Locale, node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Paris"
    >
      {node}
    </NextIntlClientProvider>
  );

const chip = (sites: readonly Channel[]) => (
  <CalendarArticleChip
    article={article}
    at={at}
    href="/articles/00000000-0000-7000-8000-0000000000a1"
    link={PlainLink}
    sites={sites}
    timeZone="Europe/Paris"
    tone="bg-primary/10"
  />
);

describe(CalendarArticleChip, () => {
  it("links the article at its time, and names its website, with no handle", async () => {
    const html = await render("en", chip([site]));

    expect(html).toContain(
      'href="/articles/00000000-0000-7000-8000-0000000000a1"'
    );
    expect(html).toContain("Spring sowing");
    expect(html).toContain("bg-primary/10");
    expect(html).toContain(
      'title="Article for Synthetic Journal (journal.example)"'
    );
    expect(html).not.toContain("button");
  });

  it("says a website no longer connected as the list does", async () => {
    const html = await render("fr", chip([]));

    expect(html).toContain('title="Un canal déconnecté"');
    expect(html).not.toContain(site.id);
  });
});
