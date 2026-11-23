import { createDownload, experimental_generateVideo } from "ai";
import { Duration, Effect, flow, Option, Schema } from "effect";

import { videoModelOf } from "./models.ts";
import type { ProviderFetch, VideoModelSettings } from "./models.ts";
import { providerStatusOf } from "./provider-status.ts";
import { VideoCallFailed } from "./video-call-failed.ts";

/**
 * The two fetches a video call sends its requests with: `api` for the
 * provider's API (the start and every poll), `download` for the video its
 * answer points to, which came from outside. Both are guarded for a
 * workspace's provider (`publicFetchWith`).
 */
export interface VideoCallFetches {
  readonly api: ProviderFetch;
  readonly download: ProviderFetch;
}

/** What to make, as the provider takes it. */
export interface VideoCall {
  /** Null leaves the length to the provider: nothing is sent. */
  readonly durationSeconds: number | null;
  /** A first frame, as its bytes. */
  readonly image: Option.Option<Uint8Array>;
  /** The largest video read; past it the download fails. */
  readonly maxBytes: number;
  /**
   * How long the SDK polls before it gives up: longer than the caller's
   * own bound, so the caller's timeout says `timedOut`.
   */
  readonly pollFor: Duration.Duration;
  /** How long between two polls of the operation, `videoPollInterval` unless set. */
  readonly pollEvery?: Duration.Duration;
  readonly prompt: string;
  readonly ratio: `${number}:${number}`;
}

/**
 * How often the operation is asked after: each poll is a request to the
 * provider, which a few minutes' wait makes a few dozen of.
 */
export const videoPollInterval = Duration.seconds(10);

// What Peal reads of the SDK's error: its name and status, never its
// message, the request's body, the provider's answer or the video's
// address.
const SdkFailureSchema = Schema.Struct({
  name: Schema.String,
  responseBody: Schema.optional(Schema.String),
  statusCode: Schema.optional(Schema.Number),
});

type SdkFailure = typeof SdkFailureSchema.Type;

const readFailure = Schema.decodeUnknownOption(SdkFailureSchema);

// The failures that say the answer held no video the SDK could read, or
// that the video it pointed to could not be fetched within its bound.
const unusable: ReadonlySet<string> = new Set([
  "AI_DownloadError",
  "AI_InvalidResponseDataError",
  "AI_JSONParseError",
  "AI_NoVideoGeneratedError",
  "AI_TypeValidationError",
]);

// A fetch that threw (the guard refused the address, the connection
// failed, the fetch's own bound passed) or was aborted.
const unsent: ReadonlySet<string> = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
]);

const failed = (kind: VideoCallFailed["kind"], status: number | null = null) =>
  new VideoCallFailed({ kind, status });

/** The SDK's failure as a VideoCallFailed, by its name and status alone. */
const failureOf = (failure: Option.Option<SdkFailure>): VideoCallFailed =>
  Option.match(failure, {
    onNone: () => failed("refused"),
    onSome: ({ name, responseBody, statusCode }) => {
      if (name === "AI_APICallError") {
        if (statusCode === undefined) {
          return failed("unsent");
        }

        // A success whose body could not be read, or went past the
        // fetch's bound.
        return statusCode >= 200 && statusCode <= 299
          ? failed("unusable")
          : failed("status", providerStatusOf(statusCode, responseBody));
      }

      if (unusable.has(name)) {
        return failed("unusable");
      }

      // An operation the provider says failed or expired is a plain
      // Error, as is anything else the package refused.
      return unsent.has(name) ? failed("unsent") : failed("refused");
    },
  });

/**
 * One video from the provider `settings` name, through the AI SDK's
 * `experimental_generateVideo`: one video, its ratio, its length when
 * asked, a first frame when given, the SDK's retries off
 * (`maxRetries: 0`: a start is billed, so it is never sent twice, nor is
 * a poll tried again), its polling bounded (`pollFor`), and the fiber's
 * abort signal, so interrupting the call aborts its request or its wait.
 * The video is downloaded through `download`, read up to `maxBytes`
 * (`createDownload`), each of its redirects checked again by the guard.
 * The provider's package is built for this call alone. It answers the
 * video's bytes, or VideoCallFailed by the kind of failure: the SDK's
 * error is never kept, logged or traced.
 */
export const generateVideoWith = (
  settings: VideoModelSettings,
  fetches: VideoCallFetches,
  {
    durationSeconds,
    image,
    maxBytes,
    pollEvery = videoPollInterval,
    pollFor,
    prompt,
    ratio,
  }: VideoCall
): Effect.Effect<Uint8Array, VideoCallFailed> =>
  Effect.tryPromise({
    catch: flow(readFailure, failureOf),
    try: async (abortSignal) => {
      const options: Parameters<typeof experimental_generateVideo>[0] = {
        abortSignal,
        aspectRatio: ratio,
        download: createDownload({ fetch: fetches.download, maxBytes }),
        maxRetries: 0,
        model: videoModelOf(settings, fetches.api),
        n: 1,
        poll: {
          intervalMs: Duration.toMillis(pollEvery),
          timeoutMs: Duration.toMillis(pollFor),
        },
        prompt: Option.match(image, {
          onNone: () => prompt,
          onSome: (bytes) => ({ image: bytes, text: prompt }),
        }),
      };

      // No length asked leaves it to the provider: nothing is sent.
      if (durationSeconds !== null) {
        options.duration = durationSeconds;
      }

      const { video } = await experimental_generateVideo(options);

      return video.uint8Array;
    },
  });
