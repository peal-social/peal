import { generateImage } from "ai";
import { Effect, flow, Option, Schema } from "effect";

import type { ImageDimensions } from "#assistant/domain/image-provider.ts";

import { ImageCallFailed } from "./image-call-failed.ts";
import { imageModelOf } from "./models.ts";
import type { ImageModelSettings, ProviderFetch } from "./models.ts";
import { providerStatusOf } from "./provider-status.ts";

/**
 * The two fetches an image call sends its requests with: `api` for the
 * request to the provider's API, `download` for what its answer points
 * to (an image given by address), which came from outside: the guarded,
 * bounded fetch (`publicFetchWith`), whatever `api` is.
 */
export interface ImageCallFetches {
  readonly api: ProviderFetch;
  readonly download: ProviderFetch;
}

/** What to make: the description, and the dimensions the provider takes. */
export interface ImageCall {
  readonly prompt: string;
  readonly dimensions: ImageDimensions;
}

// Bun's fetch offers `preconnect`, which this passes on: warming a
// connection sends nothing.
const asFetch = (
  fetch: (
    input: Request | URL | string,
    init?: RequestInit
  ) => Promise<Response>
): ProviderFetch =>
  Object.assign(fetch, { preconnect: globalThis.fetch.preconnect });

/**
 * The fetch of one call: the provider's API through `api` until it gave a
 * success, every later request (what the answer points to) through
 * `download`, where a redirect is never followed. `answered` says whether
 * the API's success came, so a failure after it is the answer's.
 */
const callFetch = ({ api, download }: ImageCallFetches) => {
  const state = { answered: false };

  const fetch = asFetch(async (input, init) => {
    if (state.answered) {
      const response = await download(input, { ...init, redirect: "manual" });

      // A redirect could lead anywhere: the address given is the image's
      // or nothing.
      if (response.status >= 300 && response.status <= 399) {
        await response.body?.cancel();

        throw new TypeError("The image's address answered with a redirect");
      }

      return response;
    }

    const response = await api(input, init);

    state.answered = response.ok;

    return response;
  });

  return { fetch, state };
};

// What Peal reads of the SDK's error: its name and status, and the
// provider's answer only to tell a wrong key (`providerStatusOf`); never
// its message or the request's body.
const SdkFailureSchema = Schema.Struct({
  name: Schema.String,
  responseBody: Schema.optional(Schema.String),
  statusCode: Schema.optional(Schema.Number),
});

type SdkFailure = typeof SdkFailureSchema.Type;

const readFailure = Schema.decodeUnknownOption(SdkFailureSchema);

// The failures that say the answer held no image the SDK could read.
const unusable: ReadonlySet<string> = new Set([
  "AI_DownloadError",
  "AI_InvalidResponseDataError",
  "AI_JSONParseError",
  "AI_NoImageGeneratedError",
  "AI_TypeValidationError",
]);

// A fetch that threw (the guard refused the address, the connection
// failed, the fetch's own bound passed) or was aborted.
const unsent: ReadonlySet<string> = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
]);

const failed = (kind: ImageCallFailed["kind"], status: number | null = null) =>
  new ImageCallFailed({ kind, status });

/**
 * The SDK's failure as an ImageCallFailed, by its name and status alone;
 * once the API answered with a success, whatever failed is the answer's.
 */
const failureOf = (
  failure: Option.Option<SdkFailure>,
  answered: boolean
): ImageCallFailed => {
  if (answered) {
    return failed("unusable");
  }

  return Option.match(failure, {
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

      return unsent.has(name) ? failed("unsent") : failed("refused");
    },
  });
};

/**
 * One image from the provider `settings` name, through the AI SDK's
 * `generateImage`: one image (`n: 1`), the dimensions as the provider takes them
 * (`size` or `aspectRatio`), the SDK's retries off (`maxRetries: 0`) and
 * the fiber's abort signal, so interrupting the call aborts its request.
 * The provider's package is built for this call alone. It answers the
 * image's bytes as they came, or ImageCallFailed by the kind of failure:
 * the SDK's error, which holds the request's body and the provider's
 * words, is never kept, logged or traced.
 */
export const generateImageWith = (
  settings: ImageModelSettings,
  fetches: ImageCallFetches,
  { prompt, dimensions }: ImageCall
): Effect.Effect<Uint8Array, ImageCallFailed> =>
  Effect.suspend(() => {
    const { fetch, state } = callFetch(fetches);

    return Effect.tryPromise({
      catch: flow(readFailure, (failure) => failureOf(failure, state.answered)),
      try: async (abortSignal) => {
        const { image } = await generateImage({
          ...dimensions,
          abortSignal,
          maxRetries: 0,
          model: imageModelOf(settings, fetch),
          n: 1,
          prompt,
        });

        return image.uint8Array;
      },
    });
  });
