import { Duration, Effect, Option, Redacted, Schema } from "effect";

import type {
  CompositionRequest,
  OwnComposerEndpoint,
} from "#assistant/application/ports/own-composer.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import { maxSlideshowBytes } from "#assistant/domain/slideshow-limits.ts";
import type { SlideshowFailureReason } from "#assistant/domain/slideshow.ts";

import { editRenderOf, slideTimelineOf } from "./timeline.ts";

/** A fetch function, guarded by the layer that builds it. */
export type ComposerFetch = typeof globalThis.fetch;

/** The fetches a render goes through: its API, and its video's download. */
export interface ComposerFetches {
  readonly api: ComposerFetch;
  readonly download: ComposerFetch;
}

// `POST /render` answers 201 with the render's id (`QueuedResponse`).
const QueuedSchema = Schema.Struct({
  response: Schema.Struct({ id: Schema.String }),
});

// `GET /render/{id}` (`RenderResponse`): where it stands, and once `done`
// the temporary link to the video.
const RenderSchema = Schema.Struct({
  response: Schema.Struct({
    status: Schema.String,
    url: Schema.optional(Schema.NullOr(Schema.String)),
  }),
});

const decodeQueued = Schema.decodeUnknownOption(QueuedSchema);

const decodeRender = Schema.decodeUnknownOption(RenderSchema);

// A render's id goes into the path as it is: a UUID, nothing else.
const renderIdPattern = /^[0-9a-f-]{36}$/iu;

/** How many polls in a row may fail for now before the job gives up. */
const transientPollFailures = 3;

/** How many redirects the video's download follows, each guarded. */
const downloadRedirects = 3;

const failWith = (kind: string, reason: SlideshowFailureReason) =>
  Effect.logWarning("A workspace's composition service failed", {
    kind,
    reason,
    source: "workspace",
  }).pipe(
    Effect.andThen(Effect.annotateCurrentSpan("peal.assistant.failure", kind)),
    Effect.andThen(Effect.fail(new SlideshowFailed({ reason })))
  );

/**
 * What a status of the service's API says, as a job's reason: 401 to 404
 * the key or the account (one without credits answers 402), a 3xx a
 * redirect never followed, 429 and 5xx busy or down, another a refusal.
 */
export const reasonOfComposerStatus = (
  status: number
): SlideshowFailureReason => {
  if (status >= 401 && status <= 404) {
    return "settingsRefused";
  }

  if (status >= 300 && status <= 399) {
    return "redirected";
  }

  return status === 429 || status >= 500 ? "unreachable" : "refused";
};

const isGuardRefusal = Schema.is(
  Schema.Struct({ _tag: Schema.Literal("OutboundRequestRefused") })
);

// A request that never got an answer: refused by the guard as it was
// sent (a TypeError whose cause is the refusal), unreachable, or cut off
// past its bound.
const unsentReason = (cause: unknown): SlideshowFailureReason =>
  cause instanceof TypeError && isGuardRefusal(cause.cause)
    ? "addressRefused"
    : "unreachable";

const send = (
  fetch: ComposerFetch,
  url: string,
  init: RequestInit
): Effect.Effect<Response, SlideshowFailed> =>
  Effect.tryPromise({
    catch: (cause) => new SlideshowFailed({ reason: unsentReason(cause) }),
    try: async (signal) => await fetch(url, { ...init, signal }),
  }).pipe(
    Effect.tapError(({ reason }) =>
      Effect.logWarning("A workspace's composition service failed", {
        kind: reason === "addressRefused" ? "AddressRefused" : "Transport",
        reason,
        source: "workspace",
      })
    )
  );

const jsonOf = (response: Response) =>
  Effect.tryPromise({
    catch: () => "unreadable" as const,
    try: async () => await response.json(),
  }).pipe(Effect.catch(() => failWith("UnusableAnswer", "unusableAnswer")));

const statusFailure = (status: number) =>
  failWith(`Status${status}`, reasonOfComposerStatus(status));

/**
 * One slide video, or one edit asked for whole, from Shotstack's Edit API,
 * at the connection's address (`…/edit/v1` or `…/edit/stage`): `POST
 * {base}/render` with the Edit (`slideTimelineOf`, or `editRenderOf`) and
 * the key in `x-api-key`, sent once and never
 * again; then `GET {base}/render/{id}` every `pollInterval` until `done`
 * (its temporary `url`) or `failed` (`refused`), a few polls in a row
 * failing for now tolerated; then the video downloaded through `download`,
 * without the key, bounded at `maxSlideshowBytes`. Nothing is logged but
 * the kind of failure: never the key, an address, a caption, the edit or
 * what the service said.
 */
export const composeWith = (
  fetches: ComposerFetches,
  endpoint: OwnComposerEndpoint,
  request: CompositionRequest,
  { pollInterval }: { readonly pollInterval: Duration.Input }
): Effect.Effect<Uint8Array, SlideshowFailed> =>
  Effect.gen(function* composing() {
    const headers = {
      "content-type": "application/json",
      "x-api-key": Redacted.value(endpoint.apiKey),
    };

    const queued = yield* send(fetches.api, `${endpoint.baseUrl}/render`, {
      body: JSON.stringify(
        "edit" in request
          ? editRenderOf(request.edit)
          : slideTimelineOf(request)
      ),
      headers,
      method: "POST",
    });

    if (!queued.ok) {
      return yield* statusFailure(queued.status);
    }

    const id = decodeQueued(yield* jsonOf(queued)).pipe(
      Option.map(({ response }) => response.id),
      Option.filter((value) => renderIdPattern.test(value))
    );

    if (Option.isNone(id)) {
      return yield* failWith("UnusableAnswer", "unusableAnswer");
    }

    const statusUrl = `${endpoint.baseUrl}/render/${id.value}`;
    const wait = Duration.fromInputUnsafe(pollInterval);
    let failures = 0;

    for (;;) {
      yield* Effect.sleep(wait);

      const polled = yield* send(fetches.api, statusUrl, {
        headers: { "x-api-key": headers["x-api-key"] },
        method: "GET",
      }).pipe(Effect.option);

      // A poll that failed for now (no answer, busy, down) is tried again,
      // a few in a row at most: the render goes on meanwhile.
      const transient =
        Option.isNone(polled) ||
        polled.value.status === 429 ||
        polled.value.status >= 500;

      if (transient) {
        failures += 1;

        if (failures >= transientPollFailures) {
          return yield* Option.match(polled, {
            onNone: () => failWith("Transport", "unreachable"),
            onSome: ({ status }) => statusFailure(status),
          });
        }

        continue;
      }

      failures = 0;

      if (!polled.value.ok) {
        return yield* statusFailure(polled.value.status);
      }

      const render = decodeRender(yield* jsonOf(polled.value));

      if (Option.isNone(render)) {
        return yield* failWith("UnusableAnswer", "unusableAnswer");
      }

      const { status, url } = render.value.response;

      if (status === "failed") {
        return yield* failWith("RenderFailed", "refused");
      }

      if (status === "done") {
        if (url === undefined || url === null || !url.startsWith("https://")) {
          return yield* failWith("UnusableAnswer", "unusableAnswer");
        }

        return yield* downloadOf(fetches.download, url);
      }
    }
  });

// The video at the render's temporary link, which carries no key: a few
// redirects followed, each through the guarded fetch.
const downloadOf = (fetch: ComposerFetch, start: string) =>
  Effect.gen(function* downloading() {
    let address = start;

    for (let hop = 0; hop <= downloadRedirects; hop += 1) {
      const answer = yield* send(fetch, address, { method: "GET" });
      const next = answer.headers.get("location");

      if (answer.status >= 300 && answer.status <= 399 && next !== null) {
        address = new URL(next, address).href;

        continue;
      }

      if (!answer.ok) {
        return yield* failWith(`Download${answer.status}`, "unusableAnswer");
      }

      const bytes = yield* Effect.tryPromise({
        catch: () => "unreadable" as const,
        try: async () => await answer.arrayBuffer(),
      }).pipe(
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.catch(() => failWith("UnusableAnswer", "unusableAnswer"))
      );

      return bytes.byteLength === 0 || bytes.byteLength > maxSlideshowBytes
        ? yield* failWith("UnusableAnswer", "unusableAnswer")
        : bytes;
    }

    return yield* failWith("Redirects", "unusableAnswer");
  });
