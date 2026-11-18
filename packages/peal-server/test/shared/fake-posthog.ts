// PostHog's capture v1 and person deletion, on a loopback port: tests that
// turn product analytics on read what the server sent, and nothing leaves
// the machine.
import { Context, Effect, Layer, Option, Schedule, Schema } from "effect";

import { fakeHttpServer, json } from "#test/channels/fakes/fake-http-server.ts";
import type {
  FakeHttpServer,
  FakeRequest,
} from "#test/channels/fakes/fake-http-server.ts";
import { TestApp } from "#test/workspace/integration/harness.ts";

/** The project token tests turn analytics on with. */
export const syntheticProjectToken = "phc_synthetic";

const CapturedSchema = Schema.Struct({
  distinct_id: Schema.String,
  event: Schema.String,
  properties: Schema.Record(Schema.String, Schema.Json),
  uuid: Schema.String,
});

/** An event as PostHog received it. */
export type CapturedEvent = typeof CapturedSchema.Type;

const decodeBatch = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ batch: Schema.Array(CapturedSchema) }))
);

const capturePath = "/i/v1/analytics/events";

const batchOf = (request: FakeRequest): readonly CapturedEvent[] =>
  request.path === capturePath
    ? decodeBatch(request.body).pipe(
        Option.match({ onNone: () => [], onSome: ({ batch }) => batch })
      )
    : [];

const DeletionRequestSchema = Schema.Struct({
  distinct_ids: Schema.Array(Schema.String),
});

const decodeDeletionRequest = Schema.decodeUnknownOption(
  Schema.fromJsonString(DeletionRequestSchema)
);

/**
 * Stores every event, and takes every deletion, as PostHog answers it:
 * the persons it found among the ids it had events of, and recordings
 * queued only for those.
 */
export const fakePostHog = Effect.suspend(() => {
  // The ids this fake received events of: its own, never the module's.
  const known = new Set<string>();

  return fakeHttpServer((request) => {
    if (request.path === capturePath) {
      const batch = batchOf(request);

      for (const { distinct_id: id } of batch) {
        known.add(id);
      }

      return json({
        results: Object.fromEntries(
          batch.map(({ uuid }) => [uuid, { result: "ok" }])
        ),
      });
    }

    if (!request.path.endsWith("/persons/bulk_delete/")) {
      return { status: 404 };
    }

    const found = Option.match(decodeDeletionRequest(request.body), {
      onNone: () => 0,
      onSome: ({ distinct_ids: ids }) =>
        ids.filter((id) => known.has(id)).length,
    });

    return json(
      {
        deletion_errors: [],
        persons_found: found,
        recordings_queued_for_deletion: found > 0,
      },
      202
    );
  });
});

/** The fake the server sends its events to. */
export class FakePostHog extends Context.Service<FakePostHog, FakeHttpServer>()(
  "peal-server/test/FakePostHog"
) {}

/** Every request the fake received so far, in order. */
export const capturedRequests = FakePostHog.use((fake) =>
  Effect.sync(() => fake.requests())
);

/** Every event the fake received so far, in order. */
export const capturedEvents = FakePostHog.use((fake) =>
  Effect.sync(() => fake.requests().flatMap(batchOf))
);

/**
 * The events that `matching` keeps, once there are at least `count`: the
 * server sends a batch every two seconds at most, so this waits for them.
 */
export const eventsMatching = (
  matching: (event: CapturedEvent) => boolean,
  count = 1
) =>
  capturedEvents.pipe(
    Effect.map((events) => events.filter(matching)),
    Effect.flatMap((found) =>
      found.length >= count ? Effect.succeed(found) : Effect.fail(found)
    ),
    Effect.retry({
      schedule: Schedule.spaced("100 millis"),
      times: 150,
    }),
    Effect.orElseSucceed(() => [])
  );

/** The deletions of persons naming `distinctId`, once there is one. */
export const deletionsOf = (distinctId: string) =>
  FakePostHog.use((fake) =>
    Effect.sync(() =>
      fake
        .requests()
        .filter(
          ({ body, path }) =>
            path.endsWith("/persons/bulk_delete/") &&
            body.includes(JSON.stringify(distinctId))
        )
    )
  ).pipe(
    Effect.flatMap((found) =>
      found.length > 0 ? Effect.succeed(found) : Effect.fail(found)
    ),
    // The deletion is a job, which runs once the erasure committed.
    Effect.retry({ schedule: Schedule.spaced("200 millis"), times: 150 }),
    Effect.orElseSucceed((): readonly FakeRequest[] => [])
  );

/** The settings that turn product analytics on, sending to the fake. */
export const postHogSettings = (posthog: FakeHttpServer) => ({
  PEAL_POSTHOG_APP_HOST: posthog.url,
  PEAL_POSTHOG_ENVIRONMENT: "test",
  PEAL_POSTHOG_HOST: posthog.url,
  PEAL_POSTHOG_KEY: syntheticProjectToken,
});

/**
 * An app `appWith` builds with the settings that send its events to a
 * fake PostHog, and the fake.
 */
export const withFakePostHog = <A, E, R>(
  appWith: (env: Readonly<Record<string, string>>) => Layer.Layer<A, E, R>
) =>
  Layer.unwrap(
    Effect.gen(function* withPostHog() {
      const posthog: FakeHttpServer = yield* fakePostHog;

      return Layer.merge(
        appWith(postHogSettings(posthog)),
        Layer.succeed(FakePostHog, posthog)
      );
    })
  );

/** The server with product analytics on, sending to the fake. */
export const appWithPostHog = (env: Readonly<Record<string, string>> = {}) =>
  withFakePostHog((settings) =>
    TestApp.layerWith({
      AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
      ...settings,
      ...env,
    })
  );
