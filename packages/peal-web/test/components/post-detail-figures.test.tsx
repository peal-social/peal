import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type {
  Permission,
  Post,
  PostAnalytics,
  PostTarget,
  SocialChannel,
  TargetMetrics,
} from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import { platformCapabilities, postAnalytics } from "#analytics/api.ts";
import { PostDetail } from "#components/posts/post-detail.tsx";
import { loadMessages } from "#i18n/messages.ts";
import { postAttempts } from "#posts/api.ts";
import { workspaceQueues } from "#queues/atoms.ts";
import { workspaceTags } from "#tags/atoms.ts";

// A published post's own page, as a member opens it from the posts list,
// the calendar or a notification: the figures each platform reported for
// it, channel by channel, beside how it went out.

const utc = (iso: string) => DateTime.makeUnsafe(iso);

const workspaceId = "019ab000-0000-7000-8000-0000000000a1";
const postId = "019ab000-0000-7000-8000-000000000001";

const channel = (
  id: string,
  handle: string,
  platform: SocialChannel["platform"],
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

const mastodon = channel(
  "019ab000-0000-7000-8000-0000000000c1",
  "@fieldnotes@social.example",
  "mastodon"
);

const bluesky = channel(
  "019ab000-0000-7000-8000-0000000000c2",
  "fieldnotes.bsky.example",
  "bluesky"
);

const profile = channel(
  "019ab000-0000-7000-8000-0000000000c3",
  "Ada Example",
  "linkedin",
  "linkedinProfile"
);

const studio = channel(
  "019ab000-0000-7000-8000-0000000000c4",
  "@studio@social.example",
  "mastodon"
);

const channels = [mastodon, bluesky, profile, studio];

const target = (
  id: string,
  channelId: string,
  fields: Partial<PostTarget>
): PostTarget => ({
  channelId,
  editedAt: null,
  failureReason: null,
  id,
  options: null,
  parts: { count: 1, live: [] },
  permalink: null,
  publishedAt: null,
  removedAt: null,
  round: 1,
  status: "pending",
  unconfirmedReason: null,
  ...fields,
});

const published = (id: string, channelId: string) =>
  target(id, channelId, {
    publishedAt: utc("2026-11-23T11:00:00Z"),
    status: "published",
  });

const failed = target("019ab000-0000-7000-8000-0000000000b4", studio.id, {
  failureReason: "channelDisconnected",
  status: "failed",
});

const postOn = (
  targets: readonly PostTarget[],
  outcome: Post["outcome"]
): Post => ({
  authorId: null,
  content: {
    media: [],
    overrides: [],
    text: "Field notes from the coast: three new tide pools mapped.",
  },
  createdVia: null,
  id: postId,
  occurrence: null,
  outcome,
  queueId: null,
  recyclingId: null,
  schedule: { at: utc("2026-11-23T11:00:00Z"), timeZone: "Europe/Paris" },
  scheduledBy: null,
  scheduledVia: null,
  shortenLinks: false,
  status: "finished",
  tagIds: [],
  targets,
});

// What analytics read of the Mastodon target: three readings, the last a
// day after it went out, and no longer read.
const read: TargetMetrics = {
  channelId: mastodon.id,
  collecting: false,
  lastCollectedAt: utc("2026-11-24T11:00:00Z"),
  latest: {
    clicks: null,
    impressions: null,
    likes: 42,
    quotes: 1,
    reach: null,
    replies: 5,
    reposts: 9,
    saves: null,
  },
  permalink: "https://social.example/@fieldnotes/113000000000000001",
  publishedAt: utc("2026-11-23T11:00:00Z"),
  snapshots: [
    {
      collectedAt: utc("2026-11-23T12:00:00Z"),
      metrics: {
        clicks: null,
        impressions: null,
        likes: 8,
        quotes: 0,
        reach: null,
        replies: 1,
        reposts: 2,
        saves: null,
      },
    },
    {
      collectedAt: utc("2026-11-24T11:00:00Z"),
      metrics: {
        clicks: null,
        impressions: null,
        likes: 42,
        quotes: 1,
        reach: null,
        replies: 5,
        reposts: 9,
        saves: null,
      },
    },
  ],
  targetId: "019ab000-0000-7000-8000-0000000000b1",
};

const everyRole: readonly Permission[] = [
  "analytics:read",
  "channel:read",
  "post:read",
];

const render = async ({
  analytics,
  locale = "en",
  permissions = everyRole,
  post,
}: {
  readonly analytics: PostAnalytics;
  readonly locale?: "en" | "fr";
  readonly permissions?: readonly Permission[];
  readonly post: Post;
}) =>
  renderToStaticMarkup(
    // Everything the page reads, already answered, so nothing is fetched;
    // the capabilities could not be read, so the page names every
    // platform Peal has a reader for.
    <RegistryProvider
      initialValues={[
        [postAnalytics(workspaceId, postId), AsyncResult.success(analytics)],
        [
          platformCapabilities(workspaceId),
          AsyncResult.fail({ _tag: "Forbidden" }),
        ],
        [postAttempts(workspaceId, postId), AsyncResult.success([])],
        [workspaceTags(workspaceId), AsyncResult.success([])],
        [workspaceQueues(workspaceId), AsyncResult.success([])],
      ]}
    >
      <NextIntlClientProvider
        locale={locale}
        messages={await loadMessages(locale)}
        timeZone="UTC"
      >
        <PostDetail
          adsLink={null}
          channels={channels}
          permissions={permissions}
          post={post}
          userId="019ab000-0000-7000-8000-0000000000d1"
          workspaceId={workspaceId}
        />
      </NextIntlClientProvider>
    </RegistryProvider>
  );

// The page's figures section alone, to tell what it says from what the
// channels above it say.
const figuresOf = (html: string): string => {
  const start = html.indexOf('aria-labelledby="post-metrics-title"');

  return start === -1
    ? ""
    : html.slice(start, html.indexOf("</section>", start));
};

describe(PostDetail, () => {
  it("shows the figures each platform reported for a published post", async () => {
    const html = await render({
      analytics: { postId, targets: [read] },
      post: postOn([published(read.targetId, mastodon.id)], "published"),
    });

    const figures = figuresOf(html);

    expect(figures).toContain(">How it did<");
    expect(figures).toContain("@fieldnotes@social.example");
    expect(figures).toContain(">Likes<");
    expect(figures).toContain(">42<");
  });

  it("leaves out a figure the platform does not give, never as 0", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [read] },
        post: postOn([published(read.targetId, mastodon.id)], "published"),
      })
    );

    expect(figures).toContain(">Reposts<");
    expect(figures).toContain(">9<");
    expect(figures).not.toContain(">Impressions<");
  });

  it("says when the figures were read, and when they are no longer", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [read] },
        post: postOn([published(read.targetId, mastodon.id)], "published"),
      })
    );

    expect(figures).toMatch(/Read Nov 24, 2026/u);
    expect(figures).toContain(
      "No longer read: posts are followed for 30 days."
    );
  });

  it("says when the figures come, before the first read", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [] },
        post: postOn([published(read.targetId, mastodon.id)], "published"),
      })
    );

    expect(figures).toContain(">How it did<");
    expect(figures).toContain("within the hour after a post goes live");
  });

  it("names a channel published since the last read as not read yet", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [read] },
        post: postOn(
          [
            published(read.targetId, mastodon.id),
            published("019ab000-0000-7000-8000-0000000000b2", bluesky.id),
          ],
          "published"
        ),
      })
    );

    expect(figures).toContain(">42<");
    expect(figures).toContain("fieldnotes.bsky.example");
    expect(figures).toContain("Not read yet");
  });

  it("says a platform reports no figures for the post", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [read] },
        post: postOn(
          [
            published(read.targetId, mastodon.id),
            published("019ab000-0000-7000-8000-0000000000b3", profile.id),
          ],
          "published"
        ),
      })
    );

    expect(figures).toContain(">42<");
    expect(figures).toContain("Counts are not available on LinkedIn profiles:");
  });

  it("shows a partly published post's figures, and the failure where it failed", async () => {
    const html = await render({
      analytics: { postId, targets: [read] },
      post: postOn(
        [published(read.targetId, mastodon.id), failed],
        "partiallyPublished"
      ),
    });

    const figures = figuresOf(html);

    expect(figures).toContain(">42<");
    expect(figures).not.toContain("@studio@social.example");
    expect(html).toContain(
      "It did not go out: its channel was disconnected from the workspace before it went out."
    );
  });

  it("shows no figures where the post went out nowhere: its failure is what shows", async () => {
    const html = await render({
      analytics: { postId, targets: [] },
      post: postOn([failed], "failed"),
    });

    expect(figuresOf(html)).toBe("");
    expect(html).not.toContain("How it did");
    expect(html).toContain("disconnected from the workspace");
  });

  it("shows no figures to a member who may not read analytics", async () => {
    const html = await render({
      analytics: { postId, targets: [read] },
      permissions: ["channel:read", "post:read"],
      post: postOn([published(read.targetId, mastodon.id)], "published"),
    });

    expect(html).not.toContain("How it did");
    expect(html).not.toContain(">42<");
  });

  it("shows them in the reader's language", async () => {
    const figures = figuresOf(
      await render({
        analytics: { postId, targets: [read] },
        locale: "fr",
        post: postOn([published(read.targetId, mastodon.id)], "published"),
      })
    );

    expect(figures).toContain("@fieldnotes@social.example");
    expect(figures).toContain(">42<");
    expect(figures).toContain("Relevée le 24 nov. 2026");
  });
});
