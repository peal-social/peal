import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { AnalyticsActor } from "#shared/application/analytics-actor.ts";
import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import type { Captured } from "#shared/application/product-analytics.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import { isSafeProperties } from "#shared/domain/product-event.ts";
import type { ProductEvent } from "#shared/domain/product-event.ts";
import {
  productEventSamples,
  sampleUserId as userId,
  sampleWorkspaceId as workspaceId,
} from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  forgotten,
  recordedAnalytics,
  recordedDelivery,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";

const excludedId = UserIdSchema.make("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");

const operation: ProductEvent = productEventSamples.api_operation.sample;

const captured = (overrides: Partial<Captured> = {}): Captured => ({
  actor: Option.none(),
  billingAccountId: Option.none(),
  event: operation,
  workspaceId: Option.some(workspaceId),
  ...overrides,
});

const asUser = Option.some({ impersonated: false, userId });

const capture = (overrides: Partial<Captured> = {}) =>
  ProductAnalytics.use((analytics) => analytics.capture(captured(overrides)));

describe("product analytics without a key", () => {
  layer(
    ProductAnalytics.layer.pipe(
      Layer.provide(
        Layer.merge(AnalyticsDelivery.none, AnalyticsScope.layerTest)
      )
    )
  )((it) => {
    it.effect("is off and sends nothing", () =>
      Effect.gen(function* off() {
        const analytics = yield* ProductAnalytics;

        assert.isFalse(analytics.enabled);
        yield* analytics.capture(captured({ actor: asUser }));
      })
    );
  });
});

describe("product analytics", () => {
  layer(recordedAnalytics)((it) => {
    it.effect("sends a person's event under their id, with the workspace", () =>
      Effect.gen(function* person() {
        yield* clearRecorded;
        yield* capture({
          actor: asUser,
          billingAccountId: Option.some("billing-account-1"),
        });

        const [sent] = yield* sentEvents;

        assert.strictEqual(sent?.distinctId, userId);
        assert.strictEqual(sent?.event, "api_operation");
        assert.deepStrictEqual(sent?.properties, {
          $geoip_disable: true,
          $groups: {
            billing_account: "billing-account-1",
            workspace: workspaceId,
          },
          actor_kind: "user",
          billing_account_id: "billing-account-1",
          environment: "test",
          error_code: "plan_limit_reached",
          operation: "posts.create",
          status: 403,
          succeeded: false,
          via: "apiKey",
          workspace_id: workspaceId,
        });
      })
    );

    it.effect(
      "sends what nobody did under the workspace's service identity",
      () =>
        Effect.gen(function* service() {
          yield* clearRecorded;
          yield* capture();

          const [sent] = yield* sentEvents;

          assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
          assert.strictEqual(sent?.properties["actor_kind"], "service");
          assert.deepStrictEqual(sent?.properties["$set"], { kind: "service" });
        })
    );

    it.effect("takes the request's actor when the caller names none", () =>
      Effect.gen(function* requestActor() {
        yield* clearRecorded;
        yield* capture().pipe(
          Effect.provideService(
            AnalyticsActor,
            AnalyticsActor.of({
              impersonated: false,
              userId: Option.some(userId),
            })
          )
        );

        const [sent] = yield* sentEvents;

        assert.strictEqual(sent?.distinctId, userId);
      })
    );

    it.effect("takes a key's request as the workspace's", () =>
      Effect.gen(function* keyActor() {
        yield* clearRecorded;
        yield* capture().pipe(
          Effect.provideService(
            AnalyticsActor,
            AnalyticsActor.of({ impersonated: false, userId: Option.none() })
          )
        );

        const [sent] = yield* sentEvents;

        assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
      })
    );

    it.effect("sends nothing of staff acting as someone", () =>
      Effect.gen(function* impersonated() {
        yield* clearRecorded;
        yield* capture({ actor: Option.some({ impersonated: true, userId }) });
        yield* capture().pipe(
          Effect.provideService(
            AnalyticsActor,
            AnalyticsActor.of({
              impersonated: true,
              userId: Option.some(userId),
            })
          )
        );

        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("sends nothing about nobody", () =>
      Effect.gen(function* nobody() {
        yield* clearRecorded;
        yield* capture({ workspaceId: Option.none() });

        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("sends only properties that may leave, for every event", () =>
      Effect.gen(function* everyEvent() {
        yield* clearRecorded;

        yield* Effect.forEach(
          Object.values(productEventSamples),
          ({ sample }) => capture({ actor: asUser, event: sample }),
          { discard: true }
        );
        yield* capture({ event: productEventSamples.post_failed.sample });

        const sent = yield* sentEvents;

        assert.strictEqual(
          sent.length,
          Object.keys(productEventSamples).length + 1
        );
        assert.isTrue(
          sent.every(({ properties }) => isSafeProperties(properties))
        );
      })
    );

    it.effect("leaves out an event whose property may not leave", () =>
      Effect.gen(function* forged() {
        yield* clearRecorded;
        yield* capture({
          actor: asUser,
          event: {
            name: "api_operation",
            properties: {
              // What decoding would refuse, forced past the types.
              ...operation.properties,
              operation: "someone@example.com",
            },
          } satisfies ProductEvent,
        });
        yield* capture({
          actor: asUser,
          billingAccountId: Option.some("an account"),
        });

        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("marks a staff member internal once", () =>
      Effect.gen(function* internal() {
        yield* clearRecorded;

        const analytics = yield* ProductAnalytics;

        yield* analytics.markInternal(userId);
        yield* analytics.markInternal(userId);

        const sent = yield* sentEvents;

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0]?.event, "$identify");
        assert.strictEqual(sent[0]?.distinctId, userId);
        assert.deepStrictEqual(sent[0]?.properties["$set"], { internal: true });
      })
    );

    it.effect("identifies a group as the subject given", () =>
      Effect.gen(function* group() {
        yield* clearRecorded;

        const analytics = yield* ProductAnalytics;

        yield* analytics.groupIdentify(
          { key: workspaceId, type: "workspace" },
          { created_at: "2026-11-18T10:00:00.000Z" },
          { _tag: "user", userId }
        );

        const [sent] = yield* sentEvents;

        assert.strictEqual(sent?.event, "$groupidentify");
        assert.strictEqual(sent?.properties["$group_type"], "workspace");
        assert.strictEqual(sent?.properties["$group_key"], workspaceId);
        assert.deepStrictEqual(sent?.properties["$group_set"], {
          created_at: "2026-11-18T10:00:00.000Z",
        });
      })
    );

    // Last in the block: what is forgotten stays forgotten.
    it.effect(
      "forgets an erased user and workspace, then sends nothing of them",
      () =>
        Effect.gen(function* erased() {
          yield* clearRecorded;

          const analytics = yield* ProductAnalytics;

          yield* analytics.forget({
            userIds: [userId],
            workspaceIds: [workspaceId],
          });
          yield* capture({ actor: asUser });
          yield* capture();
          yield* analytics.identify(userId, {
            set: { kind: "user" },
            setOnce: {},
          });

          assert.deepStrictEqual(yield* sentEvents, []);
          assert.deepStrictEqual(yield* forgotten, [
            userId,
            `workspace:${workspaceId}`,
          ]);
        })
    );
  });
});

describe("product analytics with excluded users", () => {
  layer(
    ProductAnalytics.layer.pipe(
      Layer.provide(
        Layer.succeed(
          AnalyticsScope,
          AnalyticsScope.of({
            environment: "test",
            excludedUsers: new Set([excludedId]),
          })
        )
      ),
      Layer.provideMerge(recordedDelivery)
    )
  )((it) => {
    it.effect("sends nothing about them, not even as the workspace", () =>
      Effect.gen(function* excluded() {
        const analytics = yield* ProductAnalytics;

        yield* capture({
          actor: Option.some({ impersonated: false, userId: excludedId }),
        });
        yield* analytics.markInternal(excludedId);
        yield* analytics.identify(excludedId, { set: {}, setOnce: {} });

        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );
  });
});

describe("product analytics over a delivery that dies", () => {
  layer(
    ProductAnalytics.layer.pipe(
      Layer.provide(AnalyticsScope.layerTest),
      Layer.provide(
        Layer.succeed(
          AnalyticsDelivery,
          AnalyticsDelivery.of({
            enabled: true,
            forget: () => Effect.die("forget died"),
            send: () => Effect.die("send died"),
          })
        )
      )
    )
  )((it) => {
    it.effect("never fails its caller", () =>
      Effect.gen(function* dying() {
        const analytics = yield* ProductAnalytics;

        yield* capture({ actor: asUser });
        yield* analytics.markInternal(userId);
        yield* analytics.forget({ userIds: [userId], workspaceIds: [] });
      })
    );
  });
});
