import { assert, describe, it } from "@effect/vitest";
import {
  Context,
  Duration,
  Effect,
  Exit,
  Fiber,
  Logger,
  Layer,
  Metric,
  Option,
  Redacted,
  References,
  Schema,
  Scope,
} from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import type { HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";

import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { Ids } from "#shared/application/ids.ts";
import {
  productAnalyticsErasures,
  productAnalyticsEvents,
} from "#shared/application/product-analytics.ts";
import type { EventOutcome } from "#shared/application/product-analytics.ts";
import {
  maxBatch,
  postHogDelivery,
  queueCapacity,
  requestTimeout,
  sendPause,
} from "#shared/infrastructure/posthog-delivery.ts";
import type { PostHogSettings } from "#shared/infrastructure/posthog-settings.ts";

const key = "phc_synthetic";
const personalKey = "phx_synthetic";
const shutdownTimeout = Duration.seconds(3);

interface Sent {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly path: string;
}

const decoder = new TextDecoder();

const settings = (
  overrides: Partial<PostHogSettings> = {}
): PostHogSettings => ({
  environment: "test",
  erasure: Option.none(),
  excluded: new Set(),
  host: "https://eu.i.posthog.com",
  key: Redacted.make(key),
  ...overrides,
});

const withErasure = settings({
  erasure: Option.some({
    appHost: "https://eu.posthog.com",
    personalKey: Redacted.make(personalKey),
    projectId: "12345",
  }),
});

type Answer = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response>;

// Each event PostHog was sent, by its uuid: stored.
const okFor = (request: HttpClientRequest.HttpClientRequest) => {
  const body =
    request.body._tag === "Uint8Array" ? decoder.decode(request.body.body) : "";

  const { batch } = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        batch: Schema.Array(Schema.Struct({ uuid: Schema.String })),
      })
    )
  )(body);

  return Object.fromEntries(batch.map(({ uuid }) => [uuid, { result: "ok" }]));
};

const accepted: Answer = (request) =>
  Effect.succeed(Response.json({ results: okFor(request) }, { status: 200 }));

const never: Answer = () => Effect.never;

// A delivery over a fake PostHog that answers as `answer` says, in a scope
// the test closes.
const harness = (answer: Answer, with_: PostHogSettings = settings()) =>
  Effect.gen(function* building() {
    const sent: Sent[] = [];

    const client = HttpClient.make((request, url) =>
      Effect.suspend(() => {
        sent.push({
          body:
            request.body._tag === "Uint8Array"
              ? decoder.decode(request.body.body)
              : "",
          headers: request.headers,
          path: url.pathname,
        });

        return answer(request).pipe(
          Effect.map((response) =>
            HttpClientResponse.fromWeb(request, response)
          )
        );
      })
    );

    const scope = yield* Scope.make();

    const context = yield* Layer.buildWithScope(
      postHogDelivery(with_, { shutdownTimeout }).pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
        Layer.provide(Ids.layerTest)
      ),
      scope
    );

    return {
      close: Scope.close(scope, Exit.void),
      delivery: Context.get(context, AnalyticsDelivery),
      sent,
    };
  });

const event = (index: number) => ({
  distinctId: `workspace:0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e`,
  event: "post_scheduled",
  properties: { environment: "test", target_count: index },
});

const countOf = (outcome: EventOutcome) =>
  Metric.value(Metric.withAttributes(productAnalyticsEvents, { outcome })).pipe(
    Effect.map(({ count }) => count)
  );

const erasuresOf = (outcome: string) =>
  Metric.value(
    Metric.withAttributes(productAnalyticsErasures, { outcome })
  ).pipe(Effect.map(({ count }) => count));

// Lets the sender's fiber run, without moving the clock.
const settle = Effect.forEach(
  Array.from({ length: 20 }),
  () => Effect.yieldNow,
  {
    discard: true,
  }
);

const BodySchema = Schema.fromJsonString(
  Schema.Struct({
    batch: Schema.Array(
      Schema.Struct({
        distinct_id: Schema.String,
        event: Schema.String,
        properties: Schema.Record(Schema.String, Schema.Unknown),
        timestamp: Schema.String,
        uuid: Schema.String,
      })
    ),
    created_at: Schema.String,
  })
);

describe("the PostHog delivery", () => {
  it.effect("posts a batch to capture v1 with the headers it requires", () =>
    Effect.gen(function* request() {
      const { close, delivery, sent } = yield* harness(accepted);

      yield* delivery.send(event(1));
      yield* delivery.send(event(2));
      yield* settle;

      assert.strictEqual(sent.length, 1);

      const [first] = sent;

      assert.strictEqual(first?.path, "/i/v1/analytics/events");
      assert.strictEqual(first?.headers["authorization"], `Bearer ${key}`);
      assert.strictEqual(first?.headers["content-type"], "application/json");
      assert.strictEqual(first?.headers["user-agent"], "peal-server");
      assert.strictEqual(
        first?.headers["posthog-sdk-info"],
        "peal-server/1.0.0"
      );
      assert.strictEqual(first?.headers["posthog-attempt"], "1");
      assert.match(
        first?.headers["posthog-request-id"] ?? "",
        /^[0-9a-f-]{36}$/u
      );
      assert.match(
        first?.headers["posthog-request-timestamp"] ?? "",
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u
      );

      // The token in Authorization alone.
      assert.isFalse(first?.body.includes(key));
      assert.deepStrictEqual(
        Object.entries(first?.headers ?? {})
          .filter(([, value]) => value.includes(key))
          .map(([name]) => name),
        ["authorization"]
      );

      const body = Schema.decodeUnknownSync(BodySchema)(first?.body);

      assert.strictEqual(body.batch.length, 2);
      assert.strictEqual(body.batch[0]?.event, "post_scheduled");
      assert.strictEqual(
        body.batch[0]?.distinct_id,
        "workspace:0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"
      );
      assert.deepStrictEqual(body.batch[0]?.properties, {
        environment: "test",
        target_count: 1,
      });
      assert.notStrictEqual(body.batch[0]?.uuid, body.batch[1]?.uuid);
      assert.match(body.created_at, /\.\d{3}Z$/u);

      yield* close;
    })
  );

  it.effect("sends 150 events in two requests, a pause apart", () =>
    Effect.gen(function* twoBatches() {
      const before = yield* countOf("sent");
      const { close, delivery, sent } = yield* harness(accepted);

      yield* Effect.forEach(
        Array.from({ length: 150 }, (_, index) => index),
        (index) => delivery.send(event(index)),
        { discard: true }
      );
      yield* settle;

      assert.strictEqual(sent.length, 1);
      assert.strictEqual(
        Schema.decodeUnknownSync(BodySchema)(sent[0]?.body).batch.length,
        maxBatch
      );

      yield* TestClock.adjust(Duration.subtract(sendPause, Duration.millis(1)));
      yield* settle;

      assert.strictEqual(sent.length, 1);

      yield* TestClock.adjust(Duration.millis(1));
      yield* settle;

      assert.strictEqual(sent.length, 2);
      assert.strictEqual(
        Schema.decodeUnknownSync(BodySchema)(sent[1]?.body).batch.length,
        50
      );
      assert.strictEqual((yield* countOf("sent")) - before, 150);

      yield* close;
    })
  );

  it.effect.each([
    {
      answer: (() =>
        Effect.succeed(new Response(null, { status: 500 }))) satisfies Answer,
      label: "a 500",
    },
    {
      answer: ((request) =>
        Effect.succeed(
          Response.json(
            {
              results: Object.fromEntries(
                Object.keys(okFor(request)).map((uuid) => [
                  uuid,
                  { result: "retry" },
                ])
              ),
            },
            { status: 200 }
          )
        )) satisfies Answer,
      label: "a retry result",
    },
    { answer: never, label: "a timeout" },
  ])("counts $label failed and never sends again", ({ answer }) =>
    Effect.gen(function* failing() {
      const before = yield* countOf("failed");
      const { close, delivery, sent } = yield* harness(answer);

      yield* delivery.send(event(1));
      yield* settle;
      yield* TestClock.adjust(requestTimeout);
      yield* settle;

      for (let pause = 0; pause < 5; pause += 1) {
        yield* TestClock.adjust(sendPause);
        yield* settle;
      }

      assert.strictEqual(sent.length, 1);
      assert.strictEqual((yield* countOf("failed")) - before, 1);

      yield* close;
    })
  );

  it.effect("counts a drop result rejected", () =>
    Effect.gen(function* dropped() {
      const before = yield* countOf("rejected");

      const { close, delivery } = yield* harness((request) =>
        Effect.succeed(
          Response.json(
            {
              results: Object.fromEntries(
                Object.keys(okFor(request)).map((uuid) => [
                  uuid,
                  { details: "quota", result: "drop" },
                ])
              ),
            },
            { status: 200 }
          )
        )
      );

      yield* delivery.send(event(1));
      yield* settle;

      assert.strictEqual((yield* countOf("rejected")) - before, 1);

      yield* close;
    })
  );

  it.effect("drops what a full queue cannot take, and returns at once", () =>
    Effect.gen(function* full() {
      const before = yield* countOf("dropped");
      const { close, delivery } = yield* harness(never);

      // One batch taken by the request that never ends, then the queue.
      yield* delivery.send(event(0));
      yield* settle;

      yield* Effect.forEach(
        Array.from({ length: queueCapacity + 1 }, (_, index) => index),
        (index) => delivery.send(event(index)),
        { discard: true }
      );

      assert.strictEqual((yield* countOf("dropped")) - before, 1);

      const closing = yield* Effect.forkChild(close);

      yield* settle;
      yield* TestClock.adjust(shutdownTimeout);
      yield* Fiber.join(closing);
    })
  );

  it.effect("sends what waits when it closes", () =>
    Effect.gen(function* flushed() {
      const { close, delivery, sent } = yield* harness(accepted);

      yield* delivery.send(event(1));
      yield* settle;
      yield* delivery.send(event(2));
      yield* delivery.send(event(3));
      yield* settle;

      assert.strictEqual(sent.length, 1);

      yield* close;

      assert.strictEqual(sent.length, 2);
      assert.strictEqual(
        Schema.decodeUnknownSync(BodySchema)(sent[1]?.body).batch.length,
        2
      );
    })
  );

  it.effect(
    "gives up after the shutdown timeout when PostHog never answers",
    () =>
      Effect.gen(function* givesUp() {
        const before = yield* countOf("dropped");
        const { close, delivery } = yield* harness(never);

        yield* delivery.send(event(1));
        yield* settle;
        yield* delivery.send(event(2));
        yield* settle;

        const closing = yield* Effect.forkChild(close);

        yield* settle;
        yield* TestClock.adjust(shutdownTimeout);
        yield* Fiber.join(closing);

        assert.strictEqual((yield* countOf("dropped")) - before, 2);
      })
  );
});

describe("the PostHog delivery's purge", () => {
  it.effect(
    "sends nothing more about persons it purged, even taken already",
    () =>
      Effect.gen(function* purges() {
        const { close, delivery, sent } = yield* harness(accepted);

        yield* delivery.send({ ...event(1), distinctId: "user-gone" });
        yield* settle;
        yield* delivery.send({ ...event(2), distinctId: "user-gone" });
        yield* delivery.send({ ...event(3), distinctId: "user-kept" });
        yield* delivery.purge(["user-gone"]);
        yield* delivery.send({ ...event(4), distinctId: "user-gone" });
        yield* TestClock.adjust(sendPause);
        yield* settle;

        assert.strictEqual(sent.length, 2);
        assert.deepStrictEqual(
          Schema.decodeUnknownSync(BodySchema)(sent[1]?.body).batch.map(
            ({ distinct_id: distinctId }) => distinctId
          ),
          ["user-kept"]
        );

        yield* close;
      })
  );
});

describe("the PostHog erasure", () => {
  it.effect("logs and counts the persons for the operator without a key", () =>
    Effect.gen(function* manual() {
      const before = yield* erasuresOf("manual");
      const { close, delivery, sent } = yield* harness(accepted);

      assert.strictEqual(yield* delivery.forget(["user-1"]), "manual");
      assert.strictEqual(sent.length, 0);
      assert.strictEqual((yield* erasuresOf("manual")) - before, 1);

      yield* close;
    })
  );

  it.effect("deletes persons and their events, a thousand at a time", () =>
    Effect.gen(function* deletes() {
      const before = yield* erasuresOf("requested");

      const { close, delivery, sent } = yield* harness(
        () =>
          Effect.succeed(
            Response.json(
              {
                deletion_errors: [],
                persons_found: 1,
                persons_queued_for_deletion: 1,
              },
              { status: 202 }
            )
          ),
        withErasure
      );

      const ids = Array.from({ length: 1001 }, (_, index) => `user-${index}`);

      assert.strictEqual(yield* delivery.forget(ids), "deleted");
      assert.strictEqual(sent.length, 2);
      assert.strictEqual(
        sent[0]?.path,
        "/api/projects/12345/persons/bulk_delete/"
      );
      assert.strictEqual(
        sent[0]?.headers["authorization"],
        `Bearer ${personalKey}`
      );

      const body = Schema.decodeUnknownSync(
        Schema.fromJsonString(
          Schema.Struct({
            delete_events: Schema.Boolean,
            distinct_ids: Schema.Array(Schema.String),
          })
        )
      );

      assert.strictEqual(body(sent[0]?.body).distinct_ids.length, 1000);
      assert.isTrue(body(sent[0]?.body).delete_events);
      assert.deepStrictEqual(body(sent[1]?.body).distinct_ids, ["user-1000"]);
      assert.strictEqual((yield* erasuresOf("requested")) - before, 1);

      yield* close;
    })
  );

  it.effect("fails a deletion PostHog reports errors for, once", () =>
    Effect.gen(function* deletionErrors() {
      const { close, delivery, sent } = yield* harness(
        () =>
          Effect.succeed(
            Response.json(
              { deletion_errors: [{ distinct_id: "user-1" }] },
              { status: 202 }
            )
          ),
        withErasure
      );

      const failed = yield* delivery.forget(["user-1"]).pipe(Effect.flip);

      assert.strictEqual(failed._tag, "AnalyticsErasureFailed");
      assert.strictEqual(failed.status, 202);
      // Trying again is the job's, durably, not the adapter's.
      assert.strictEqual(sent.length, 1);

      yield* close;
    })
  );
});

describe("the PostHog delivery's logs", () => {
  it.effect.each([key, personalKey])(
    "never write a key PostHog echoes back as its label: %s",
    (echoed) => {
      const lines: string[] = [];

      return Effect.gen(function* echoes() {
        const { close, delivery } = yield* harness(
          () =>
            Effect.succeed(Response.json({ error: echoed }, { status: 401 })),
          withErasure
        );

        yield* delivery.send(event(1));
        yield* settle;
        yield* close;

        const written = lines.join("\n");

        assert.include(
          written,
          "PostHog did not take product analytics events"
        );
        assert.notInclude(written, echoed);
      }).pipe(
        Effect.provide(
          Logger.layer([
            Logger.make(({ fiber, message }) => {
              lines.push(
                JSON.stringify(message),
                JSON.stringify(fiber.getRef(References.CurrentLogAnnotations))
              );
            }),
          ])
        )
      );
    }
  );
});

describe("a delivery without a key", () => {
  it.effect(
    "leaves a deletion still asked of it for the operator, logged",
    () => {
      const lines: string[] = [];

      return AnalyticsDelivery.use((delivery) =>
        delivery.forget(["user-1", "workspace:workspace-1"])
      ).pipe(
        Effect.tap((outcome) =>
          Effect.sync(() => {
            const written = lines.join("\n");

            assert.strictEqual(outcome, "manual");
            assert.include(written, "peal.erasure.analytics_manual");
            assert.include(written, "workspace:workspace-1");
          })
        ),
        Effect.provide(
          Layer.merge(
            AnalyticsDelivery.none,
            Logger.layer([
              Logger.make(({ fiber, message }) => {
                lines.push(
                  JSON.stringify(message),
                  JSON.stringify(fiber.getRef(References.CurrentLogAnnotations))
                );
              }),
            ])
          )
        )
      );
    }
  );
});
