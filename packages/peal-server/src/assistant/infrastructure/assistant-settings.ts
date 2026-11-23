import { Config, Option, Redacted, Schema } from "effect";

import {
  imageProviderAddresses,
  ImageProviderIdSchema,
} from "#assistant/domain/image-provider.ts";
import type { ImageProviderId } from "#assistant/domain/image-provider.ts";
import {
  providerAddresses,
  TextProviderIdSchema,
} from "#assistant/domain/text-provider.ts";
import type { TextProviderId } from "#assistant/domain/text-provider.ts";

/** The model the assistant asks on Anthropic's API, unless PEAL_AI_MODEL names another. */
export const defaultAnthropicModel = "claude-opus-5-5";

/**
 * How many requests a workspace may send the assistant each UTC day, unless
 * PEAL_AI_DAILY_REQUESTS says otherwise.
 */
export const defaultDailyRequests = 100;

/** The language model the assistant writes with, if any. */
export type AssistantProvider =
  | { readonly _tag: "Off" }
  | {
      readonly _tag: "On";
      /** None for an `openai-compatible` endpoint that takes no key. */
      readonly apiKey: Option.Option<Redacted.Redacted>;
      /**
       * Where its API is reached: for Anthropic, the address `/v1/messages`
       * follows (its own unless `PEAL_AI_BASE_URL` names a proxy); for the
       * others, the one `/chat/completions` follows.
       */
      readonly baseUrl: string;
      readonly model: string;
      readonly provider: TextProviderId;
    };

// Without the slashes that end it, so the API's paths can follow.
const urlConfig = (name: string) =>
  Config.URL(name).pipe(Config.map((url) => url.href.replace(/\/+$/u, "")));

const requiredKey = Config.schema(
  Schema.Redacted(Schema.NonEmptyString),
  "PEAL_AI_API_KEY"
).pipe(Config.map(Option.some));

const optionalKey = Config.option(Config.Redacted("PEAL_AI_API_KEY")).pipe(
  Config.map(Option.filter((key) => Redacted.value(key) !== ""))
);

// A provider Peal knows is reached at its own address unless another is
// named, with its key; Anthropic asks its default model unless another is
// named. Any other endpoint names its own models and is reached at its
// own address: both must be given, so drafts never go to a host nobody
// named, and its key is optional.
const providerConfig = (provider: TextProviderId) => {
  const address = providerAddresses[provider];

  return Config.all({
    apiKey: provider === "openai-compatible" ? optionalKey : requiredKey,
    baseUrl:
      address === null
        ? urlConfig("PEAL_AI_BASE_URL")
        : urlConfig("PEAL_AI_BASE_URL").pipe(Config.withDefault(address)),
    model:
      provider === "anthropic"
        ? Config.NonEmptyString("PEAL_AI_MODEL").pipe(
            Config.withDefault(defaultAnthropicModel)
          )
        : Config.NonEmptyString("PEAL_AI_MODEL"),
  }).pipe(
    Config.map((settings): AssistantProvider => ({
      _tag: "On",
      ...settings,
      provider,
    }))
  );
};

const off = Config.succeed<AssistantProvider>({ _tag: "Off" });

/**
 * The assistant's language model, read from the environment:
 *
 * - `PEAL_AI_PROVIDER`: a provider's id (`anthropic`, `openai`, `google`,
 *   `mistral`, `xai`, `groq`, `togetherai`, `deepseek`, `openrouter`,
 *   `cerebras`, `fireworks`), or `openai-compatible` for any other
 *   endpoint. Unset or empty, the assistant is off: its endpoints answer
 *   AssistantUnavailable and the web app hides it.
 * - `PEAL_AI_API_KEY`: the provider's key, required but for an
 *   OpenAI-compatible endpoint.
 * - `PEAL_AI_MODEL`: the model; `claude-opus-5-5` by default on Anthropic,
 *   required for every other.
 * - `PEAL_AI_BASE_URL`: the API's base URL, such as
 *   `http://127.0.0.1:8000/v1`; required for an OpenAI-compatible endpoint,
 *   and for the others only behind a proxy.
 */
export const assistantProviderConfig = Config.Literals(
  ["", ...TextProviderIdSchema.literals],
  "PEAL_AI_PROVIDER"
).pipe(
  Config.withDefault(""),
  Config.flatMap((name) => (name === "" ? off : providerConfig(name)))
);

/**
 * `PEAL_AI_DAILY_REQUESTS`: how many requests each workspace may send the
 * assistant per UTC day, 100 unless set. 0 lets none through.
 */
export const dailyRequestsConfig = Config.schema(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  "PEAL_AI_DAILY_REQUESTS"
).pipe(Config.withDefault(defaultDailyRequests));

/** The model the assistant makes images with, if any. */
export type ImageProvider =
  | { readonly _tag: "Off" }
  | {
      readonly _tag: "On";
      /** None for an `openai-compatible` endpoint that takes no key. */
      readonly apiKey: Option.Option<Redacted.Redacted>;
      /**
       * Where its images API is reached: its own unless
       * `PEAL_AI_IMAGE_BASE_URL` names another; for `openai-compatible`,
       * the address `/images/generations` follows.
       */
      readonly baseUrl: string;
      readonly model: string;
      readonly provider: ImageProviderId;
    };

const imageKey = Config.option(Config.Redacted("PEAL_AI_IMAGE_API_KEY")).pipe(
  Config.map(Option.filter((key) => Redacted.value(key) !== ""))
);

const requiredImageKey = Config.schema(
  Schema.Redacted(Schema.NonEmptyString),
  "PEAL_AI_IMAGE_API_KEY"
).pipe(Config.map(Option.some));

// A provider Peal knows is reached at its own address unless another is
// named, with its key. Any other endpoint is reached at the address the
// operator names, its key optional. Each is asked the model the operator
// names, which must be given.
const imageProviderSettings = (provider: ImageProviderId) => {
  const address = imageProviderAddresses[provider];

  return Config.all({
    apiKey: provider === "openai-compatible" ? imageKey : requiredImageKey,
    baseUrl:
      address === null
        ? urlConfig("PEAL_AI_IMAGE_BASE_URL")
        : urlConfig("PEAL_AI_IMAGE_BASE_URL").pipe(Config.withDefault(address)),
    model: Config.NonEmptyString("PEAL_AI_IMAGE_MODEL"),
  }).pipe(
    Config.map((settings): ImageProvider => ({
      _tag: "On",
      ...settings,
      provider,
    }))
  );
};

/**
 * The assistant's image model, read from the environment when the server
 * starts, apart from the writing model, which may make no images:
 *
 * - `PEAL_AI_IMAGE_PROVIDER`: a provider's id (`openai`, `google`, `xai`,
 *   `togetherai`), or `openai-compatible` for any other endpoint that
 *   serves `/images/generations`. Unset or empty, images are off: the
 *   endpoint answers AssistantUnavailable and clients hide it.
 * - `PEAL_AI_IMAGE_BASE_URL`: the API's base URL; required for
 *   `openai-compatible`, and for the others only behind a proxy.
 * - `PEAL_AI_IMAGE_API_KEY`: the provider's key, required but for an
 *   OpenAI-compatible endpoint.
 * - `PEAL_AI_IMAGE_MODEL`: the model, required.
 *
 * A provider named without its base URL, its key or its model stops the
 * server.
 */
export const imageProviderConfig = Config.Literals(
  ["", ...ImageProviderIdSchema.literals],
  "PEAL_AI_IMAGE_PROVIDER"
).pipe(
  Config.withDefault(""),
  Config.flatMap((name) =>
    name === ""
      ? Config.succeed<ImageProvider>({ _tag: "Off" })
      : imageProviderSettings(name)
  )
);
