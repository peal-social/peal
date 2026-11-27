import { describe, expect, it } from "@effect/vitest";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type { Channel } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import type { ArticlesLink } from "#components/articles/articles-list-view.tsx";
import { BlogsListView } from "#components/articles/blogs-list-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const Anchor: ArticlesLink = ({ children, className, href }) => (
  <a className={className} href={href}>
    {children}
  </a>
);

const wordpress: Channel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "notes.example",
  id: "00000000-0000-7000-8000-0000000000d1",
  label: "Field notes",
  platform: "wordpress",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const hashnode: Channel = {
  ...wordpress,
  handle: "synthetic.hashnode.example",
  id: "00000000-0000-7000-8000-0000000000d2",
  label: null,
  platform: "hashnode",
};

const hrefs = {
  blog: (id: string) => `/north-studio/blogs/${id}`,
  connect: "/north-studio/channels",
};

const render = async (
  sites: AsyncResult.AsyncResult<readonly Channel[], unknown>
) => {
  const messages = await loadMessages("en");

  return {
    html: renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <BlogsListView
          hrefs={hrefs}
          link={Anchor}
          onRetry={() => {
            // Nothing to read again in a render.
          }}
          sites={sites}
        />
      </NextIntlClientProvider>
    ),
    t: messages.Articles.blogs,
  };
};

// Blogs: the workspace's websites, each opening its articles.
describe(BlogsListView, () => {
  it("lists each website with its name and handle, opening its blog", async () => {
    const { html, t } = await render(
      AsyncResult.success([wordpress, hashnode])
    );

    expect(
      [
        "Field notes",
        "notes.example",
        "synthetic.hashnode.example",
        `href="${hrefs.blog(wordpress.id)}"`,
        `href="${hrefs.blog(hashnode.id)}"`,
      ].filter((text) => !html.includes(text))
    ).toStrictEqual([]);
    expect(html.match(/<svg/gu)).toHaveLength(2);
    expect(html).not.toContain(t.emptyTitle);
  });

  it("points to Channels when no website is connected", async () => {
    const { html, t } = await render(AsyncResult.success([]));

    expect(html).toContain(t.emptyTitle);
    expect(html).toContain(t.empty);
    expect(html).toContain(`href="${hrefs.connect}"`);
  });

  it("loads until the websites are known, never saying there are none", async () => {
    const { html, t } = await render(AsyncResult.initial());

    expect(html).toContain("aria-busy");
    expect(html).toContain(t.loading);
    expect(html).not.toContain(t.emptyTitle);
  });

  it("says the websites could not be read, with a way to try again", async () => {
    const { html, t } = await render(AsyncResult.fail("unavailable"));

    expect(html).toContain(t.loadFailed);
    expect(html).toContain(t.retry);
    expect(html).not.toContain(t.emptyTitle);
  });
});
