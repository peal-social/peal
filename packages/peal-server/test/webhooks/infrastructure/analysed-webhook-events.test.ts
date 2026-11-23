import { assert, describe, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";

import { AnalyticsActor } from "#shared/application/analytics-actor.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import {
  ChannelIdSchema,
  MediaAssetIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  Uuid7Schema,
} from "#shared/domain/ids.ts";
import {
  sampleUserId as userId,
  sampleWorkspaceId as workspaceId,
} from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";
import { WebhookEvents } from "#webhooks/application/webhook-events.ts";
import type { EventToPublish } from "#webhooks/application/webhook-events.ts";
import { analysedWebhookEvents } from "#webhooks/infrastructure/analysed-webhook-events.ts";

const channelId = ChannelIdSchema.make("00000000-0000-7000-8000-0000000000c1");
const postId = PostIdSchema.make("00000000-0000-7000-8000-0000000000d1");

const targetId = PostTargetIdSchema.make(
  "00000000-0000-7000-8000-0000000000e1"
);

const articleId = Uuid7Schema.make("00000000-0000-7000-8000-0000000000f1");

const at = DateTime.makeUnsafe("2026-11-18T10:00:00.000Z");

// The events the stub refuses: its database fails.
const failing = "post-target:failing";

const Told = Layer.succeed(
  WebhookEvents,
  WebhookEvents.of({
    publish: ({ key }) =>
      key === failing
        ? Effect.fail(new DatabaseError({ cause: "synthetic" }))
        : Effect.void,
  })
);

const publish = (request: EventToPublish) =>
  WebhookEvents.use((events) => events.publish(request));

const told = (request: EventToPublish) =>
  Effect.gen(function* telling() {
    yield* clearRecorded;
    yield* publish(request);

    return yield* sentEvents;
  });

const published = (platform: "x" | null): EventToPublish => ({
  event: {
    data: {
      channelId,
      permalink: "https://x.example/status/1?ref=share",
      platform,
      postId,
      publishedAt: at,
      round: 1,
      targetId,
      workspaceId,
    },
    type: "post.published",
  },
  key: `post-target:${targetId}:1:published`,
});

describe("the webhook events product analytics hears", () => {
  layer(
    analysedWebhookEvents(Told).pipe(Layer.provideMerge(recordedAnalytics))
  )((it) => {
    it.effect("tells a channel connected, with its platform", () =>
      Effect.gen(function* connected() {
        const [sent] = yield* told({
          event: {
            data: {
              channelId,
              platform: "bluesky",
              reconnected: true,
              workspaceId,
            },
            type: "channel.connected",
          },
          key: `channel:${channelId}:connected`,
        });

        assert.strictEqual(sent?.event, "channel_connected");
        assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
        assert.strictEqual(sent?.properties["channel_id"], channelId);
        assert.strictEqual(sent?.properties["platform"], "bluesky");
        assert.strictEqual(sent?.properties["reconnected"], true);
      })
    );

    it.effect("tells a channel disconnected", () =>
      Effect.gen(function* disconnected() {
        const [sent] = yield* told({
          event: {
            data: { channelId, platform: "wordpress", workspaceId },
            type: "channel.disconnected",
          },
          key: `channel:${channelId}:disconnected`,
        });

        assert.strictEqual(sent?.event, "channel_disconnected");
        assert.strictEqual(sent?.properties["platform"], "wordpress");
      })
    );

    it.effect(
      "tells a channel to reconnect, and one expiring without when",
      () =>
        Effect.gen(function* unhealthy() {
          const [needed] = yield* told({
            event: {
              data: { channelId, platform: "instagram", workspaceId },
              type: "channel.reconnect_needed",
            },
            key: `channel:${channelId}:reconnect-needed`,
          });

          assert.strictEqual(needed?.event, "channel_reconnect_needed");
          assert.strictEqual(needed?.distinctId, `workspace:${workspaceId}`);
          assert.strictEqual(needed?.properties["channel_id"], channelId);
          assert.strictEqual(needed?.properties["platform"], "instagram");

          const [expiring] = yield* told({
            event: {
              data: {
                channelId,
                expiresAt: at,
                platform: "linkedin",
                workspaceId,
              },
              type: "channel.expiring",
            },
            key: `channel:${channelId}:expiring`,
          });

          assert.strictEqual(expiring?.event, "channel_expiring");
          assert.strictEqual(expiring?.properties["platform"], "linkedin");
          assert.notProperty(expiring?.properties, "expires_at");
        })
    );

    it.effect(
      "tells an article published or failed, never its permalink or the site's code",
      () =>
        Effect.gen(function* articles() {
          const [went] = yield* told({
            event: {
              data: {
                articleId,
                channelId,
                permalink: "https://blog.example/a-note?ref=share",
                platform: "wordpress",
                platformPostId: "42",
                publishedAt: at,
                siteStatus: "publish",
                workspaceId,
              },
              type: "article.published",
            },
            key: `article:${articleId}:published`,
          });

          assert.strictEqual(went?.event, "article_published");
          assert.deepStrictEqual(
            Object.keys(went?.properties ?? {})
              .filter((key) => !key.startsWith("$"))
              .toSorted(),
            [
              "actor_kind",
              "article_id",
              "channel_id",
              "environment",
              "platform",
              "site_status",
              "workspace_id",
            ]
          );
          assert.strictEqual(went?.properties["site_status"], "publish");

          const [failed] = yield* told({
            event: {
              data: {
                articleId,
                channelId,
                code: "rest_cannot_create",
                failedAt: at,
                platform: null,
                reason: "tokenExpired",
                workspaceId,
              },
              type: "article.failed",
            },
            key: `article:${articleId}:failed`,
          });

          assert.strictEqual(failed?.event, "article_failed");
          assert.strictEqual(failed?.properties["reason"], "tokenExpired");
          assert.notProperty(failed?.properties, "platform");
          assert.notProperty(failed?.properties, "code");
        })
    );

    it.effect("tells a file refused, with its reason", () =>
      Effect.gen(function* refused() {
        const mediaId = MediaAssetIdSchema.make(targetId);

        const [sent] = yield* told({
          event: {
            data: { mediaId, reason: "unsupported", workspaceId },
            type: "media.failed",
          },
          key: `media:${mediaId}:failed:unsupported`,
        });

        assert.strictEqual(sent?.event, "media_failed");
        assert.strictEqual(sent?.properties["media_id"], mediaId);
        assert.strictEqual(sent?.properties["reason"], "unsupported");
      })
    );

    it.effect(
      "tells a post scheduled by how many channels, never its zone",
      () =>
        Effect.gen(function* scheduled() {
          const [sent] = yield* told({
            event: {
              data: {
                postId,
                scheduledAt: at,
                targets: [
                  { channelId, platform: "x", targetId },
                  { channelId, platform: null, targetId },
                ],
                timeZone: "Europe/Paris",
                workspaceId,
              },
              type: "post.scheduled",
            },
            key: `post:${postId}:scheduled`,
            postChannelIds: [channelId],
          });

          assert.strictEqual(sent?.event, "post_scheduled");
          assert.strictEqual(sent?.properties["post_id"], postId);
          assert.strictEqual(sent?.properties["target_count"], 2);
          assert.notInclude(Object.keys(sent?.properties ?? {}), "time_zone");
        })
    );

    it.effect("tells a post published, never its permalink", () =>
      Effect.gen(function* publishedPost() {
        const [sent] = yield* told(published("x"));

        assert.strictEqual(sent?.event, "post_published");
        assert.deepStrictEqual(Object.keys(sent?.properties ?? {}).toSorted(), [
          "$geoip_disable",
          "$groups",
          "$set_once",
          "actor_kind",
          "channel_id",
          "environment",
          "platform",
          "post_id",
          "round",
          "workspace_id",
        ]);
        assert.notInclude(JSON.stringify(sent), "x.example");
      })
    );

    it.effect("leaves the platform out when the channel is gone", () =>
      Effect.gen(function* withoutPlatform() {
        const [sent] = yield* told(published(null));

        assert.notInclude(Object.keys(sent?.properties ?? {}), "platform");
      })
    );

    it.effect("tells a post failed with its reason", () =>
      Effect.gen(function* failed() {
        const [sent] = yield* told({
          event: {
            data: {
              channelId,
              failedAt: at,
              platform: "linkedin",
              postId,
              reason: "tokenExpired",
              round: 2,
              targetId,
              workspaceId,
            },
            type: "post.failed",
          },
          key: `post-target:${targetId}:2:failed`,
        });

        assert.strictEqual(sent?.event, "post_failed");
        assert.strictEqual(sent?.properties["reason"], "tokenExpired");
        assert.strictEqual(sent?.properties["round"], 2);
      })
    );

    it.effect("tells nothing of the other events", () =>
      Effect.gen(function* untold() {
        assert.deepStrictEqual(
          yield* told({
            event: {
              data: {
                contentType: "image/png",
                mediaId: MediaAssetIdSchema.make(targetId),
                workspaceId,
              },
              type: "media.ready",
            },
            key: `media:${targetId}:ready`,
          }),
          []
        );
        assert.deepStrictEqual(
          yield* told({
            event: {
              data: {
                finishedAt: at,
                outcome: "published",
                postId,
                round: 1,
                targets: [],
                workspaceId,
              },
              type: "post.finished",
            },
            key: `post:${postId}:finished`,
            postChannelIds: [],
          }),
          []
        );
      })
    );

    it.effect("tells nothing when publishing failed, and fails the same", () =>
      Effect.gen(function* refused() {
        yield* clearRecorded;

        const failure = yield* publish({
          ...published("x"),
          key: failing,
        }).pipe(Effect.flip);

        assert.strictEqual(failure._tag, "DatabaseError");
        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("tells it as the request's person when there is one", () =>
      Effect.gen(function* person() {
        const [sent] = yield* told(published("x")).pipe(
          Effect.provideService(
            AnalyticsActor,
            AnalyticsActor.of({
              impersonated: false,
              sessionId: Option.none(),
              userId: Option.some(userId),
            })
          )
        );

        assert.strictEqual(sent?.distinctId, userId);
        assert.strictEqual(sent?.properties["actor_kind"], "user");
      })
    );
  });
});
