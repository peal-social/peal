import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type { Article, Channel } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ArticlesListView } from "#components/articles/articles-list-view.tsx";
import type { ArticlesLink } from "#components/articles/articles-list-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const Anchor: ArticlesLink = ({ children, className, href }) => (
  <a className={className} href={href}>
    {children}
  </a>
);

const site: Channel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "notes.example",
  id: "00000000-0000-7000-8000-0000000000d1",
  label: null,
  platform: "wordpress",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const other: Channel = {
  ...site,
  handle: "other.example",
  id: "00000000-0000-7000-8000-0000000000d2",
};

const articleOn = (channel: Channel, id: string, title: string): Article => ({
  authorId: null,
  body: { content: [], type: "doc" },
  categories: [],
  channelId: channel.id,
  coverMediaId: null,
  createdAt: DateTime.makeUnsafe("2026-11-13T09:00:00Z"),
  excerpt: null,
  id,
  siteStatus: "publish",
  state: { _tag: "draft" },
  tags: [],
  title,
  updatedAt: DateTime.makeUnsafe("2026-11-13T09:00:00Z"),
});

const hrefs = {
  article: (id: string) => `/north-studio/blogs/${site.id}/${id}`,
  newArticle: `/north-studio/blogs/${site.id}/new`,
};

const none = { items: [] } satisfies { readonly items: readonly Article[] };

const render = async (node: ReactNode) => {
  const messages = await loadMessages("en");

  return {
    html: renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {node}
      </NextIntlClientProvider>
    ),
    t: messages.Articles.list,
  };
};

const listOf = (
  articles: AsyncResult.AsyncResult<
    { readonly items: readonly Article[] },
    unknown
  >,
  sites: AsyncResult.AsyncResult<readonly Channel[], unknown>
) => (
  <ArticlesListView
    articles={articles}
    canCreate
    channelId={site.id}
    hrefs={hrefs}
    link={Anchor}
    onRetry={() => {
      // Nothing to read again in a render.
    }}
    sites={sites}
  />
);

// What a blog shows once hydrated: loading until it knows the articles
// and the websites, then its own website's articles alone.
describe(ArticlesListView, () => {
  it.each([
    ["both", AsyncResult.initial(), AsyncResult.initial()],
    ["the websites", AsyncResult.success(none), AsyncResult.initial()],
    ["the articles", AsyncResult.initial(), AsyncResult.success([site])],
  ] as const)("loads while %s are being read", async (_, articles, sites) => {
    const { html, t } = await render(listOf(articles, sites));

    expect(html).not.toContain(t.siteNotFound);
    expect(html).toContain("aria-busy");
    expect(html).toContain(t.loading);
  });

  it("lists the blog's own articles, and no other website's", async () => {
    const { html } = await render(
      listOf(
        AsyncResult.success({
          items: [
            articleOn(site, "a1", "Spring sowing"),
            articleOn(other, "a2", "Autumn pruning"),
          ],
        }),
        AsyncResult.success([site, other])
      )
    );

    expect(html).toContain("Spring sowing");
    expect(html).toContain(`href="${hrefs.article("a1")}"`);
    expect(html).not.toContain("Autumn pruning");
  });

  it("says a blog without an article has none", async () => {
    const { html, t } = await render(
      listOf(
        AsyncResult.success({ items: [articleOn(other, "a2", "Autumn")] }),
        AsyncResult.success([site, other])
      )
    );

    expect(html).toContain(t.empty);
    expect(html).not.toContain("aria-busy");
  });

  it("says so when the website is not the workspace's", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.success(none), AsyncResult.success([other]))
    );

    expect(html).toContain(t.siteNotFound);
    expect(html).not.toContain(t.empty);
  });

  it("says the page could not be read when the websites could not", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.success(none), AsyncResult.fail("unavailable"))
    );

    expect(html).not.toContain(t.siteNotFound);
    expect(html).toContain(t.loadFailed);
    expect(html).toContain(t.retry);
  });

  it("says the page could not be read when the articles could not", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.fail("unavailable"), AsyncResult.success([site]))
    );

    expect(html).toContain(t.loadFailed);
    expect(html).toContain(t.retry);
  });
});
