import { describe, expect, it } from "@effect/vitest";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type { Article, Channel } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ArticlesActions,
  ArticlesListView,
} from "#components/articles/articles-list-view.tsx";
import type { ArticlesLink } from "#components/articles/articles-list-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const Anchor: ArticlesLink = ({ children, className, href }) => (
  <a className={className} href={href}>
    {children}
  </a>
);

const hrefs = {
  article: (id: string) => `/north-studio/articles/${id}`,
  connect: "/north-studio/channels",
  newArticle: "/north-studio/articles/new",
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
    hrefs={hrefs}
    link={Anchor}
    onRetry={() => {
      // Nothing to read again in a render.
    }}
    sites={sites}
  />
);

// What the page shows once hydrated: loading until it knows the articles
// and the websites, never "no website" before it does.
describe(ArticlesListView, () => {
  it.each([
    ["both", AsyncResult.initial(), AsyncResult.initial()],
    ["the websites", AsyncResult.success(none), AsyncResult.initial()],
    ["the articles", AsyncResult.initial(), AsyncResult.success([])],
  ] as const)("loads while %s are being read", async (_, articles, sites) => {
    const { html, t } = await render(listOf(articles, sites));

    expect(html).not.toContain(t.noSite);
    expect(html).not.toContain(t.connect);
    expect(html).toContain("aria-busy");
    expect(html).toContain(t.loading);
  });

  it("says a workspace with no website has none, once read", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.success(none), AsyncResult.success([]))
    );

    expect(html).toContain(t.noSite);
    expect(html).toContain(t.empty);
    expect(html).not.toContain("aria-busy");
  });

  it("says the page could not be read when the websites could not, never that there are none", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.success(none), AsyncResult.fail("unavailable"))
    );

    expect(html).not.toContain(t.noSite);
    expect(html).toContain(t.loadFailed);
    expect(html).toContain(t.retry);
  });

  it("says the page could not be read when the articles could not", async () => {
    const { html, t } = await render(
      listOf(AsyncResult.fail("unavailable"), AsyncResult.success([]))
    );

    expect(html).toContain(t.loadFailed);
    expect(html).toContain(t.retry);
  });
});

describe(ArticlesActions, () => {
  it("offers to connect a website where there is none", async () => {
    const { html, t } = await render(
      <ArticlesActions canCreate hrefs={hrefs} link={Anchor} sites={[]} />
    );

    expect(html).toContain(t.connect);
    expect(html).toContain(`href="${hrefs.connect}"`);
    expect(html).not.toContain(t.new);
  });
});
