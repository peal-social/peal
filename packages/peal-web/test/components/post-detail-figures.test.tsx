import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration } from "effect";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import { Forbidden, InvalidRequest } from "peal-contract";
import type {
  Permission,
  Platform,
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
// it, channel by channel, beside how it went out. The page reads the clock,
// so the post's times are set from it; exact dates are the view's tests'.

const ago = (duration: Duration.Duration) =>
  DateTime.subtractDuration(DateTime.nowUnsafe(), duration);

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

const published = (
  id: string,
  channelId: string,
  wentOut: Duration.Duration = Duration.days(1)
) =>
  target(id, channelId, {
    publishedAt: ago(wentOut),
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
  schedule: { at: ago(Duration.days(1)), timeZone: "Europe/Paris" },
  scheduledBy: null,
  scheduledVia: null,
  shortenLinks: false,
  status: "finished",
  tagIds: [],
  targets,
});

const metrics = {
  clicks: null,
  impressions: null,
  likes: 42,
  quotes: 1,
  reach: null,
  replies: 5,
  reposts: 9,
  saves: null,
};

// What analytics read of the Mastodon target, a day after it went out:
// two readings, and still read.
const read: TargetMetrics = {
  channelId: mastodon.id,
  collecting: true,
  lastCollectedAt: ago(Duration.hours(1)),
  latest: metrics,
  permalink: "https://social.example/@fieldnotes/113000000000000001",
  publishedAt: ago(Duration.days(1)),
  snapshots: [
    {
      collectedAt: ago(Duration.hours(23)),
      metrics: { ...metrics, likes: 8, quotes: 0, replies: 1, reposts: 2 },
    },
    { collectedAt: ago(Duration.hours(1)), metrics },
  ],
  targetId: "019ab000-0000-7000-8000-0000000000b1",
};

const everyRole: readonly Permission[] = [
  "analytics:read",
  "channel:read",
  "post:read",
];

// This server's capabilities: counts on Mastodon, Bluesky and LinkedIn
// pages.
const capabilitiesOf = (platforms: readonly Platform[]) =>
  platforms.map((platform) => ({
    analytics: { accountNumbers: [], perPost: true, postCounts: [] },
    platform,
  }));

const render = async ({
  analytics = AsyncResult.success({ postId, targets: [read] }),
  capabilities = AsyncResult.success(
    capabilitiesOf(["mastodon", "bluesky", "linkedin"])
  ),
  locale = "en",
  permissions = everyRole,
  post,
}: {
  readonly analytics?: AsyncResult.AsyncResult<PostAnalytics, unknown>;
  readonly capabilities?: AsyncResult.AsyncResult<unknown, unknown>;
  readonly locale?: "en" | "fr";
  readonly permissions?: readonly Permission[];
  readonly post: Post;
}) =>
  renderToStaticMarkup(
    // Everything the page reads, already answered, so nothing is fetched.
    <RegistryProvider
      initialValues={[
        [postAnalytics(workspaceId, postId), analytics],
        [platformCapabilities(workspaceId), capabilities],
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

const onMastodon = postOn([published(read.targetId, mastodon.id)], "published");

describe(PostDetail, () => {
  it("shows the figures each platform reported for a published post", async () => {
    const figures = figuresOf(await render({ post: onMastodon }));

    expect(figures).toContain(">How it did<");
    expect(figures).toContain(">@fieldnotes@social.example on Mastodon</h3>");
    expect(figures).toContain(">Likes<");
    expect(figures).toContain(">42<");
  });

  it("leaves out a figure the platform does not give, never as 0", async () => {
    const figures = figuresOf(await render({ post: onMastodon }));

    expect(figures).toContain(">Reposts<");
    expect(figures).toContain(">9<");
    expect(figures).not.toContain(">Impressions<");
  });

  it("says counts come on a channel the post went out on minutes ago", async () => {
    const figures = figuresOf(
      await render({
        post: postOn(
          [
            published(read.targetId, mastodon.id),
            published(
              "019ab000-0000-7000-8000-0000000000b2",
              bluesky.id,
              Duration.minutes(5)
            ),
          ],
          "published"
        ),
      })
    );

    expect(figures).toContain(">fieldnotes.bsky.example on Bluesky</h3>");
    expect(figures).toContain(
      "Counts come within the hour after the post goes live."
    );
    expect(figures).not.toContain("30 days");
  });

  it("says on the channel's own row that its platform gives no counts", async () => {
    const figures = figuresOf(
      await render({
        post: postOn(
          [
            published(read.targetId, mastodon.id),
            published("019ab000-0000-7000-8000-0000000000b3", profile.id),
          ],
          "published"
        ),
      })
    );

    expect(figures).toContain(">Ada Example on LinkedIn</h3>");
    expect(figures).toContain(
      "LinkedIn gives Peal no counts for a profile&#x27;s posts."
    );
  });

  it("shows a partly published post's figures, and the failure where it failed", async () => {
    const html = await render({
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
      analytics: AsyncResult.success({ postId, targets: [] }),
      post: postOn([failed], "failed"),
    });

    expect(figuresOf(html)).toBe("");
    expect(html).not.toContain("How it did");
    expect(html).toContain("disconnected from the workspace");
  });

  it("shows no figures to a member who may not read analytics", async () => {
    const html = await render({
      permissions: ["channel:read", "post:read"],
      post: onMastodon,
    });

    expect(html).not.toContain("How it did");
    expect(html).not.toContain(">42<");
  });

  it("holds a row's place for each channel while the figures load", async () => {
    const figures = figuresOf(
      await render({
        analytics: AsyncResult.initial(true),
        post: onMastodon,
      })
    );

    expect(figures).toContain('aria-busy="true"');
    expect(figures).toContain("Loading the post’s counts…");
    // The read row's chart has its place already.
    expect(figures).toContain("h-64");
  });

  it("offers to try again when the figures could not be loaded", async () => {
    const figures = figuresOf(
      await render({
        analytics: AsyncResult.fail(new InvalidRequest({ issues: [] })),
        post: onMastodon,
      })
    );

    expect(figures).toContain("The post’s counts could not be loaded.");
    expect(figures).toContain(">Try again<");
  });

  it("says a refusal without offering to try again", async () => {
    const figures = figuresOf(
      await render({
        analytics: AsyncResult.fail(
          new Forbidden({ permission: "analytics:read" })
        ),
        post: onMastodon,
      })
    );

    expect(figures).toContain("You can&#x27;t see this post&#x27;s counts.");
    expect(figures).not.toContain(">Try again<");
  });

  it("promises no count when the server's capabilities could not be read", async () => {
    const figures = figuresOf(
      await render({
        analytics: AsyncResult.success({ postId, targets: [] }),
        capabilities: AsyncResult.fail(new Forbidden({})),
        post: postOn(
          [published(read.targetId, mastodon.id, Duration.minutes(5))],
          "published"
        ),
      })
    );

    expect(figures).toContain("No counts have been read yet.");
    expect(figures).not.toContain("within the hour");
  });

  it("shows them in the reader's language", async () => {
    const figures = figuresOf(await render({ locale: "fr", post: onMastodon }));

    expect(figures).toContain(">Ce qu’elle a donné<");
    expect(figures).toContain(">@fieldnotes@social.example sur Mastodon</h3>");
    expect(figures).toContain(">42<");
  });
});
