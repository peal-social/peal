import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Fiber,
  Layer,
  Option,
  Queue,
  Redacted,
  Ref,
  Schema,
  Semaphore,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import type {
  ErasureOutcome,
  OutgoingEvent,
} from "#shared/application/analytics-delivery.ts";
import { AnalyticsErasureFailed } from "#shared/application/analytics-erasure-failed.ts";
import { Ids } from "#shared/application/ids.ts";
import {
  countErasure,
  countEvents,
} from "#shared/application/product-analytics.ts";
import type { EventOutcome } from "#shared/application/product-analytics.ts";
import { AnalyticsTokenSchema } from "#shared/domain/product-event.ts";
import type { SafeProperties } from "#shared/domain/product-event.ts";
import type { PostHogSettings } from "#shared/infrastructure/posthog-settings.ts";

/** Events waiting to be sent at most: past it, an event is dropped. */
export const queueCapacity = 5000;

/** Events in one request at most. */
export const maxBatch = 100;

/** The wait after each request: one request every two seconds at most. */
export const sendPause = Duration.seconds(2);

/** How long a request to PostHog may take. */
export const requestTimeout = Duration.seconds(10);

/** Persons deleted in one request at most, as PostHog takes them. */
export const maxErasureBatch = 1000;

/** What a warning about failed sends is written once in, at most. */
export const failureLogEvery = Duration.minutes(1);

/** The version of this adapter's wire format, in `PostHog-Sdk-Info`. */
export const sdkInfo = "peal-server/1.0.0";

// An event as it waits: stamped when it was handed over.
interface Stamped {
  readonly distinctId: string;
  readonly event: string;
  readonly properties: SafeProperties;
  readonly timestamp: string;
  readonly uuid: string;
}

// What capture v1 answers with a 200: a result per event, by its uuid.
const AcceptedSchema = Schema.Struct({
  results: Schema.Record(
    Schema.String,
    Schema.Struct({ result: Schema.String })
  ),
});

const decodeAccepted = Schema.decodeUnknownOption(AcceptedSchema);

// PostHog's label for a refusal, never more of its answer: a code such as
// `invalid_token`, one word of letters, digits and `_.:/-`. A sentence,
// which could quote what was sent, is left out.
const RefusalSchema = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
});

const decodeLabel = Schema.decodeUnknownOption(AnalyticsTokenSchema);

const decodeRefusal = Schema.decodeUnknownOption(RefusalSchema);

// What the bulk deletion answers with a 202. It queues recordings only for
// persons it found (`recordings_queued_for_deletion` is false when it found
// none), so a deletion counts as done once it says they are queued, or
// that it found nobody to delete.
const DeletionSchema = Schema.Struct({
  deletion_errors: Schema.Array(Schema.Unknown),
  persons_found: Schema.optionalKey(Schema.Number),
  recordings_queued_for_deletion: Schema.optionalKey(Schema.Boolean),
});

const decodeDeletion = Schema.decodeUnknownOption(DeletionSchema);

// A result PostHog may add later counts as stored, as its docs say.
const outcomeOf = (result: string): EventOutcome => {
  if (result === "drop") {
    return "rejected";
  }

  return result === "retry" ? "failed" : "sent";
};

// No span and no trace context: a request to PostHog is not Peal's to
// trace, and its headers hold the token.
const untraced = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(HttpClient.TracerPropagationEnabled, false),
    Effect.withTracerEnabled(false)
  );

/**
 * Events to a PostHog project, on capture v1: `send` stamps the event and
 * queues it (at most `queueCapacity`; past it the event is dropped), and
 * one fiber sends what waits, `maxBatch` at a time, pausing `sendPause`
 * after each request. Nothing is sent twice: a request that fails is
 * counted and logged, and its events are gone. When the layer closes, it
 * sends what waits within `shutdownTimeout` and counts the rest dropped.
 * `forget` deletes persons with the personal key, or logs them for the
 * operator without it.
 */
export const postHogDelivery = (
  settings: PostHogSettings,
  { shutdownTimeout }: { readonly shutdownTimeout: Duration.Input }
): Layer.Layer<AnalyticsDelivery, never, HttpClient.HttpClient | Ids> =>
  Layer.effect(
    AnalyticsDelivery,
    Effect.gen(function* PostHogDelivery() {
      const client = yield* HttpClient.HttpClient;
      const ids = yield* Ids;
      const queue = yield* Queue.dropping<Stamped>(queueCapacity);
      const endpoint = `${settings.host}/i/v1/analytics/events`;

      // What no log line may hold, should PostHog echo it back.
      const secrets = [
        Redacted.value(settings.key),
        ...Option.toArray(settings.erasure).map(({ personalKey }) =>
          Redacted.value(personalKey)
        ),
      ];

      // When each kind of failure was last written, so a flood writes one
      // a minute.
      const lastWritten = yield* Ref.make<ReadonlyMap<string, number>>(
        new Map()
      );

      const sampled = (kind: string, written: Effect.Effect<void>) =>
        Effect.gen(function* sampling() {
          const now = DateTime.toEpochMillis(yield* DateTime.now);

          const due = yield* Ref.modify(lastWritten, (last) => {
            const before = last.get(kind);

            return before !== undefined &&
              now - before < Duration.toMillis(failureLogEvery)
              ? [false, last]
              : [true, new Map(last).set(kind, now)];
          });

          yield* due ? written : Effect.void;
        });

      const warn = (
        kind: "failed" | "rejected",
        status: Option.Option<number>,
        label: Option.Option<string>
      ) =>
        sampled(
          kind,
          Effect.logWarning(
            kind === "failed"
              ? "PostHog did not take product analytics events"
              : "PostHog dropped product analytics events"
          ).pipe(
            Effect.annotateLogs({
              "http.response.status_code": Option.getOrUndefined(status),
              "peal.product_analytics.label": Option.getOrUndefined(label),
            })
          )
        );

      const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));

      const requestOf = (batch: readonly Stamped[]) =>
        Effect.gen(function* building() {
          const sentAt = yield* now;

          return HttpClientRequest.post(endpoint).pipe(
            HttpClientRequest.bearerToken(Redacted.value(settings.key)),
            HttpClientRequest.setHeaders({
              "PostHog-Attempt": "1",
              "PostHog-Request-Id": yield* ids.next,
              "PostHog-Request-Timestamp": sentAt,
              "PostHog-Sdk-Info": sdkInfo,
              "User-Agent": "peal-server",
            }),
            HttpClientRequest.bodyJsonUnsafe({
              batch: batch.map((stamped) => ({
                distinct_id: stamped.distinctId,
                event: stamped.event,
                properties: stamped.properties,
                timestamp: stamped.timestamp,
                uuid: stamped.uuid,
              })),
              created_at: sentAt,
            })
          );
        });

      // One request, once: each event counted by what PostHog said of it,
      // or the whole batch failed.
      const sendBatch = (batch: readonly Stamped[]) =>
        Effect.gen(function* sending() {
          const response = yield* client
            .execute(yield* requestOf(batch))
            .pipe(Effect.timeout(requestTimeout), untraced);

          const body = yield* response.json.pipe(
            Effect.timeout(requestTimeout),
            Effect.option,
            untraced
          );

          const accepted =
            response.status === 200
              ? body.pipe(Option.flatMap(decodeAccepted))
              : Option.none();

          if (Option.isNone(accepted)) {
            yield* countEvents("failed", batch.length);

            return yield* warn(
              "failed",
              Option.some(response.status),
              body.pipe(
                Option.flatMap(decodeRefusal),
                Option.flatMap(({ error }) => decodeLabel(error)),
                // Never a key, should PostHog echo one.
                Option.filter(
                  (label) => !secrets.some((secret) => label.includes(secret))
                )
              )
            );
          }

          const outcomes = batch.map((stamped) =>
            Option.fromUndefinedOr(
              accepted.value.results[stamped.uuid.toLowerCase()]
            ).pipe(
              Option.match({
                onNone: (): EventOutcome => "sent",
                onSome: ({ result }) => outcomeOf(result),
              })
            )
          );

          const counted = (outcome: EventOutcome) =>
            outcomes.filter((each) => each === outcome).length;

          yield* countEvents("sent", counted("sent"));
          yield* countEvents("rejected", counted("rejected"));
          yield* countEvents("failed", counted("failed"));

          yield* counted("rejected") > 0
            ? warn("rejected", Option.some(200), Option.none())
            : Effect.void;

          return yield* counted("failed") > 0
            ? warn("failed", Option.some(200), Option.some("retry"))
            : Effect.void;
        }).pipe(
          Effect.catchCause(() =>
            countEvents("failed", batch.length).pipe(
              Effect.andThen(warn("failed", Option.none(), Option.none()))
            )
          )
        );

      // The events not yet sent of persons being forgotten: left out of
      // every batch, even one already taken from the queue.
      const purged = yield* Ref.make<ReadonlySet<string>>(new Set());

      // Held while a request is in flight, so a purge waits for it.
      const posting = yield* Semaphore.make(1);

      // The events taken from the queue and not yet answered: dropped if
      // the server stops meanwhile.
      const inFlight = yield* Ref.make(0);

      const post = (taken: readonly Stamped[]) =>
        posting.withPermits(1)(
          Effect.gen(function* posted() {
            const forgotten = yield* Ref.get(purged);

            const batch = taken.filter(
              ({ distinctId }) => !forgotten.has(distinctId)
            );

            yield* countEvents("dropped", taken.length - batch.length);

            yield* batch.length === 0 ? Effect.void : sendBatch(batch);
          })
        );

      const sender = Queue.takeBetween(queue, 1, maxBatch).pipe(
        Effect.tap((taken) => Ref.set(inFlight, taken.length)),
        Effect.flatMap(post),
        Effect.andThen(Ref.set(inFlight, 0)),
        Effect.andThen(Effect.sleep(sendPause)),
        Effect.forever
      );

      const running = yield* Effect.forkScoped(sender);

      // At shutdown: a batch cut short counted dropped, what waits sent
      // within the time given, the rest dropped.
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* flushing() {
          yield* Fiber.interrupt(running);
          yield* countEvents("dropped", yield* Ref.get(inFlight));

          const waiting = yield* Queue.clear(queue).pipe(
            Effect.orElseSucceed((): Stamped[] => [])
          );

          const left = yield* Ref.make(waiting.length);

          yield* Effect.forEach(
            Arr.chunksOf(waiting, maxBatch),
            (batch) =>
              post(batch).pipe(
                Effect.andThen(
                  Ref.update(left, (count) => count - batch.length)
                )
              ),
            { discard: true }
          ).pipe(
            Effect.timeoutOption(shutdownTimeout),
            Effect.andThen(Ref.get(left)),
            Effect.flatMap((count) => countEvents("dropped", count))
          );
        })
      );

      const send = (event: OutgoingEvent) =>
        Effect.gen(function* queueing() {
          const stamped: Stamped = {
            ...event,
            timestamp: yield* now,
            uuid: yield* ids.next,
          };

          const queued = yield* Queue.offer(queue, stamped);

          yield* queued ? Effect.void : countEvents("dropped");
        });

      // Nothing waiting, nor taken and not yet sent, goes out about them;
      // a request in flight is waited for.
      const purge = (distinctIds: readonly string[]) =>
        Effect.gen(function* purging() {
          yield* Ref.update(
            purged,
            (forgotten) => new Set([...forgotten, ...distinctIds])
          );

          const leaving = new Set(distinctIds);

          const waiting = yield* Queue.clear(queue).pipe(
            Effect.orElseSucceed((): Stamped[] => [])
          );

          const kept = waiting.filter(
            ({ distinctId }) => !leaving.has(distinctId)
          );

          yield* countEvents("dropped", waiting.length - kept.length);
          // What no longer fits, should sends have filled the queue
          // meanwhile, is dropped.
          const refused = yield* Queue.offerAll(queue, kept);

          yield* countEvents("dropped", refused.length);
          yield* posting.withPermits(1)(Effect.void);
        });

      const deleteOnce = (
        erasure: Option.Option.Value<PostHogSettings["erasure"]>,
        distinctIds: readonly string[]
      ) =>
        Effect.gen(function* deleting() {
          const response = yield* client
            .execute(
              HttpClientRequest.post(
                `${erasure.appHost}/api/projects/${erasure.projectId}/persons/bulk_delete/`
              ).pipe(
                HttpClientRequest.bearerToken(
                  Redacted.value(erasure.personalKey)
                ),
                HttpClientRequest.bodyJsonUnsafe({
                  delete_events: true,
                  delete_recordings: true,
                  distinct_ids: distinctIds,
                })
              )
            )
            .pipe(Effect.timeout(requestTimeout), untraced);

          const body = yield* response.json.pipe(
            Effect.timeout(requestTimeout),
            Effect.option,
            untraced
          );

          const done =
            response.status === 202 &&
            Option.exists(
              body.pipe(Option.flatMap(decodeDeletion)),
              (answer) =>
                answer.deletion_errors.length === 0 &&
                (answer.recordings_queued_for_deletion === true ||
                  answer.persons_found === 0)
            );

          return yield* done
            ? Effect.void
            : Effect.fail(
                new AnalyticsErasureFailed({ status: response.status })
              );
        }).pipe(
          // A timeout, a network failure or an answer it cannot read.
          Effect.mapError((failure) =>
            failure._tag === "AnalyticsErasureFailed"
              ? failure
              : new AnalyticsErasureFailed({})
          )
        );

      // One request a chunk of persons. A deletion is idempotent: PostHog
      // does not queue it twice, so a chunk deleted before is deleted
      // again harmlessly when the whole is tried again.
      const forget = (distinctIds: readonly string[]) =>
        Option.match(settings.erasure, {
          // Ids only, as `peal.erasure` logs them.
          onNone: () =>
            countErasure("manual").pipe(
              Effect.andThen(
                Effect.logWarning(
                  "An erasure's persons stay at PostHog without PEAL_POSTHOG_PERSONAL_API_KEY: delete them there by hand"
                ).pipe(
                  Effect.annotateLogs({
                    distinctIds: distinctIds.join(","),
                    "event.name": "peal.erasure.analytics_manual",
                  })
                )
              ),
              Effect.as<ErasureOutcome>("manual")
            ),
          onSome: (erasure) =>
            Effect.forEach(
              Arr.chunksOf(distinctIds, maxErasureBatch),
              (chunk) => deleteOnce(erasure, chunk),
              { discard: true }
            ).pipe(
              Effect.andThen(countErasure("requested")),
              Effect.as<ErasureOutcome>("deleted")
            ),
        });

      return AnalyticsDelivery.of({ enabled: true, forget, purge, send });
    })
  );
