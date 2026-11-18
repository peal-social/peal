import { Effect, Layer, Match, Option } from "effect";

import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import type { Platform } from "#shared/domain/platform.ts";
import type { ProductEvent } from "#shared/domain/product-event.ts";
import { WebhookEvents } from "#webhooks/application/webhook-events.ts";
import type { WebhookEvent } from "#webhooks/domain/webhook-event.ts";

// A target's platform, which is null once its channel is gone: no key then.
const platformOf = (platform: Platform | null) =>
  Option.match(Option.fromNullishOr(platform), {
    onNone: () => ({}),
    onSome: (known) => ({ platform: known }),
  });

const untold = () => Option.none<ProductEvent>();

/**
 * The product analytics event a webhook event tells, if any: a channel
 * connected or disconnected, a post scheduled, published or failed. Ids,
 * platforms, counts and codes only: never a permalink, a time zone or an
 * instant. Exhaustive, so a new type does not compile until it says.
 */
export const productEventOf: (
  event: WebhookEvent
) => Option.Option<ProductEvent> = Match.type<WebhookEvent>().pipe(
  Match.discriminatorsExhaustive("type")({
    "article.failed": untold,
    "article.published": untold,
    "boost.budget_reached": untold,
    "boost.ended": untold,
    "boost.failed": untold,
    "boost.paused": untold,
    "boost.resumed": untold,
    "boost.started": untold,
    "boost.stopped": untold,
    "boost.unconfirmed": untold,
    "channel.connected": ({ data }) =>
      Option.some<ProductEvent>({
        name: "channel_connected",
        properties: {
          channelId: data.channelId,
          platform: data.platform,
          reconnected: data.reconnected,
        },
      }),
    "channel.disabled": untold,
    "channel.disconnected": ({ data }) =>
      Option.some<ProductEvent>({
        name: "channel_disconnected",
        properties: { channelId: data.channelId, platform: data.platform },
      }),
    "channel.enabled": untold,
    "channel.expiring": untold,
    "channel.reconnect_needed": untold,
    "comment.received": untold,
    "comment.replied": untold,
    "media.failed": untold,
    "media.ready": untold,
    "message.received": untold,
    "message.sent": untold,
    "post.approval_requested": untold,
    "post.approved": untold,
    "post.cancelled": untold,
    "post.changes_requested": untold,
    "post.edit_failed": untold,
    "post.edited": untold,
    "post.failed": ({ data }) =>
      Option.some<ProductEvent>({
        name: "post_failed",
        properties: {
          channelId: data.channelId,
          ...platformOf(data.platform),
          postId: data.postId,
          reason: data.reason,
          round: data.round,
        },
      }),
    "post.finished": untold,
    "post.published": ({ data }) =>
      Option.some<ProductEvent>({
        name: "post_published",
        properties: {
          channelId: data.channelId,
          ...platformOf(data.platform),
          postId: data.postId,
          round: data.round,
        },
      }),
    "post.scheduled": ({ data }) =>
      Option.some<ProductEvent>({
        name: "post_scheduled",
        properties: { postId: data.postId, targetCount: data.targets.length },
      }),
    "post.unconfirmed": untold,
    "post.unpublish_failed": untold,
    "post.unpublished": untold,
    "post.unscheduled": untold,
    "review.received": untold,
    "review.replied": untold,
    "webhook.test": untold,
  })
);

/**
 * WebhookEvents that also tell product analytics of the milestones of
 * posts and channels, once `told` published the event. The actor is the
 * request's person when there is one, the workspace's service identity
 * otherwise (a job).
 *
 * Known and accepted: `publish` joins the caller's transaction, and the
 * analytics event is queued when it returns, before that transaction
 * commits. One that then rolls back leaves an analytics event for what did
 * not happen, and a workflow step run again can send one twice. Both are
 * rare, and nothing but analytics reads these events.
 */
export const analysedWebhookEvents = <E, R>(
  told: Layer.Layer<WebhookEvents, E, R>
) =>
  Layer.effect(
    WebhookEvents,
    Effect.gen(function* AnalysedWebhookEvents() {
      const events = yield* WebhookEvents;
      const analytics = yield* ProductAnalytics;

      return WebhookEvents.of({
        publish: (request) =>
          events.publish(request).pipe(
            Effect.tap(() =>
              Option.match(productEventOf(request.event), {
                onNone: () => Effect.void,
                onSome: (event) =>
                  analytics.capture({
                    actor: Option.none(),
                    billingAccountId: Option.none(),
                    event,
                    workspaceId: Option.some(request.event.data.workspaceId),
                  }),
              })
            )
          ),
      });
    })
  ).pipe(Layer.provide(told));
