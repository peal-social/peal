import { createAnthropic } from "@ai-sdk/anthropic";
import { createCerebras } from "@ai-sdk/cerebras";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { createFal } from "@ai-sdk/fal";
import { createFireworks } from "@ai-sdk/fireworks";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createXai } from "@ai-sdk/xai";
import { customProvider } from "ai";
import type {
  experimental_generateVideo,
  generateSpeech,
  ImageModel,
  LanguageModel,
  transcribe,
} from "ai";
import { Option, Redacted } from "effect";

import type {
  SpeechProviderId,
  TranscriptionProviderId,
} from "#assistant/domain/audio-provider.ts";
import type { ImageProviderId } from "#assistant/domain/image-provider.ts";
import type { TextProviderId } from "#assistant/domain/text-provider.ts";
import type { VideoProviderId } from "#assistant/domain/video-provider.ts";

// The SDK writes its warnings (a setting a model ignores) to the console,
// and resolves a model named by a string alone through a hosted gateway
// of its vendor's, unless told otherwise: Peal logs through Effect only,
// and never sends a prompt anywhere but where its settings say. The
// provider below has no model, so a string model id throws before any
// request.
globalThis.AI_SDK_LOG_WARNINGS = false;

globalThis.AI_SDK_DEFAULT_PROVIDER = customProvider({});

/** A text model's settings: which provider, where, with which key and model. */
export interface TextModelSettings {
  /** None for an endpoint that takes requests without a key. */
  readonly apiKey: Option.Option<Redacted.Redacted>;
  /**
   * Where its API is reached: for Anthropic, the address `/v1/messages`
   * follows; for the others, the one `/chat/completions` follows.
   */
  readonly baseUrl: string;
  readonly model: string;
  readonly provider: TextProviderId;
}

/** The fetch a provider sends its requests with. */
export type ProviderFetch = typeof globalThis.fetch;

// Every factory is given its key and its address: left out, each would
// read its own environment variables (`ANTHROPIC_BASE_URL`,
// `<PROVIDER>_API_KEY`), which are not Peal's settings. A missing key is
// sent empty, never looked up.
const keyOf = (settings: {
  readonly apiKey: Option.Option<Redacted.Redacted>;
}) =>
  Option.match(settings.apiKey, {
    onNone: () => "",
    onSome: Redacted.value,
  });

// Any endpoint that serves chat completions, asked for a strict JSON
// schema as `response_format`, its usage in the stream's last event.
type CompatibleSettings = Parameters<typeof createOpenAICompatible>[0];

const compatibleWith =
  (extra: Partial<CompatibleSettings>) =>
  (settings: TextModelSettings, fetch: ProviderFetch) => {
    const options: CompatibleSettings = {
      ...extra,
      baseURL: settings.baseUrl,
      fetch,
      includeUsage: true,
      name: settings.provider,
      supportsStructuredOutputs: true,
    };

    // No key, no Authorization header.
    if (Option.isSome(settings.apiKey)) {
      options.apiKey = Redacted.value(settings.apiKey.value);
    }

    return createOpenAICompatible(options).languageModel(settings.model);
  };

const compatible = compatibleWith({});

const builders: Readonly<
  Record<
    TextProviderId,
    (settings: TextModelSettings, fetch: ProviderFetch) => LanguageModel
  >
> = {
  // Peal keeps Anthropic's address without its version, which the
  // package expects in its base URL.
  anthropic: (settings, fetch) =>
    createAnthropic({
      apiKey: keyOf(settings),
      baseURL: `${settings.baseUrl}/v1`,
      fetch,
    }).languageModel(settings.model),
  cerebras: (settings, fetch) =>
    createCerebras({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).languageModel(settings.model),
  // DeepSeek answers `json_object` only: its package sends the schema in
  // the instructions.
  deepseek: (settings, fetch) =>
    createDeepSeek({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).languageModel(settings.model),
  fireworks: (settings, fetch) =>
    createFireworks({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).languageModel(settings.model),
  google: compatible,
  groq: compatible,
  mistral: compatible,
  openai: compatible,
  "openai-compatible": compatible,
  // OpenRouter routes a request to any of a model's hosts unless told to
  // keep to those that take every parameter sent (the JSON schema, the
  // tools).
  openrouter: compatibleWith({
    transformRequestBody: (body) => ({
      ...body,
      provider: { require_parameters: true },
    }),
  }),
  togetherai: compatible,
  xai: compatible,
};

/**
 * The AI SDK's language model for a text provider's settings, sending its
 * requests through `fetch`: plain fetch for the operator's own provider,
 * the guarded one (`publicFetchWith`) for a workspace's. Built for each
 * call, never cached, so a key lives no longer than its request. The key
 * leaves `Redacted` here alone.
 */
export const textModelOf = (
  settings: TextModelSettings,
  fetch: ProviderFetch
): LanguageModel => builders[settings.provider](settings, fetch);

/** An image model's settings: which provider, where, with which key and model. */
export interface ImageModelSettings {
  /** None for an `openai-compatible` endpoint that takes requests without a key. */
  readonly apiKey: Option.Option<Redacted.Redacted>;
  /**
   * Where its images API is reached: for `openai-compatible`, the address
   * `/images/generations` follows.
   */
  readonly baseUrl: string;
  readonly model: string;
  readonly provider: ImageProviderId;
}

// Each provider's own images API, built with its key, its address and the
// fetch given. `openai-compatible` sends `POST {base}/images/generations`
// with the model, the prompt, one image and its size, as Peal's own
// adapter did, and no key when there is none.
const imageBuilders: Readonly<
  Record<
    ImageProviderId,
    (settings: ImageModelSettings, fetch: ProviderFetch) => ImageModel
  >
> = {
  fal: (settings, fetch) =>
    createFal({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).image(settings.model),
  google: (settings, fetch) =>
    createGoogle({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).image(settings.model),
  openai: (settings, fetch) =>
    createOpenAI({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).image(settings.model),
  "openai-compatible": (settings, fetch) => {
    const options: CompatibleSettings = {
      baseURL: settings.baseUrl,
      fetch,
      name: settings.provider,
    };

    if (Option.isSome(settings.apiKey)) {
      options.apiKey = Redacted.value(settings.apiKey.value);
    }

    return createOpenAICompatible(options).imageModel(settings.model);
  },
  togetherai: (settings, fetch) =>
    createTogetherAI({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).image(settings.model),
  xai: (settings, fetch) =>
    createXai({
      apiKey: keyOf(settings),
      baseURL: settings.baseUrl,
      fetch,
    }).image(settings.model),
};

/**
 * The AI SDK's image model for an image provider's settings, sending its
 * requests through `fetch` (see `imageCallFetch` in `image-model.ts`).
 * Built for each call, never cached, so a key lives no longer than its
 * request. The key leaves `Redacted` here alone.
 */
export const imageModelOf = (
  settings: ImageModelSettings,
  fetch: ProviderFetch
): ImageModel => imageBuilders[settings.provider](settings, fetch);

/** The SDK's video model, as `experimental_generateVideo` takes it. */
export type VideoModel = Parameters<
  typeof experimental_generateVideo
>[0]["model"];

/** A video model's settings: which provider, where, with which key and model. */
export interface VideoModelSettings {
  readonly apiKey: Redacted.Redacted;
  /** Where its video API is reached (Gemini's `…/v1beta`, xAI's `…/v1`). */
  readonly baseUrl: string;
  readonly model: string;
  readonly provider: VideoProviderId;
}

// Each provider's own video API, built with its key, its address and the
// fetch given: Veo's `models/{model}:predictLongRunning` at Gemini's API,
// then its operation polled; xAI's `videos/generations`, then
// `videos/{id}`.
const videoBuilders: Readonly<
  Record<
    VideoProviderId,
    (settings: VideoModelSettings, fetch: ProviderFetch) => VideoModel
  >
> = {
  google: (settings, fetch) =>
    createGoogle({
      apiKey: Redacted.value(settings.apiKey),
      baseURL: settings.baseUrl,
      fetch,
    }).video(settings.model),
  xai: (settings, fetch) =>
    createXai({
      apiKey: Redacted.value(settings.apiKey),
      baseURL: settings.baseUrl,
      fetch,
    }).video(settings.model),
};

/**
 * The AI SDK's video model for a workspace's video provider, sending its
 * requests (the start and every poll) through `fetch`, the guarded one.
 * Built for each call, never cached. The key leaves `Redacted` here alone.
 */
export const videoModelOf = (
  settings: VideoModelSettings,
  fetch: ProviderFetch
): VideoModel => videoBuilders[settings.provider](settings, fetch);

/** The SDK's speech model, as `generateSpeech` takes it. */
export type SpeechModel = Parameters<typeof generateSpeech>[0]["model"];

/** The SDK's transcription model, as `transcribe` takes it. */
export type TranscriptionModel = Parameters<typeof transcribe>[0]["model"];

/** A speech model's settings: which provider, where, with which key and model. */
export interface SpeechModelSettings {
  readonly apiKey: Redacted.Redacted;
  /** Where its speech API is reached. */
  readonly baseUrl: string;
  readonly model: string;
  readonly provider: SpeechProviderId;
}

/** A transcription model's settings: which provider, where, with which key and model. */
export interface TranscriptionModelSettings {
  readonly apiKey: Redacted.Redacted;
  /** Where its transcription API is reached. */
  readonly baseUrl: string;
  readonly model: string;
  readonly provider: TranscriptionProviderId;
}

// The settings every audio factory takes but ElevenLabs': the key, the
// address and the fetch. ElevenLabs' package sends to `api.elevenlabs.io`,
// and fal's its speech and transcripts to `fal.run` and `queue.fal.run`,
// whatever the address: their connections take their own address alone.
const audioOptions = (
  settings: SpeechModelSettings | TranscriptionModelSettings,
  fetch: ProviderFetch
) => ({
  apiKey: Redacted.value(settings.apiKey),
  baseURL: settings.baseUrl,
  fetch,
});

// Each provider's own speech API: OpenAI's `audio/speech`, Gemini's
// `generateContent`, Mistral's `audio/speech`, xAI's `tts` (which takes
// no model), ElevenLabs' `text-to-speech/{voice}`, fal's model endpoint.
const speechBuilders: Readonly<
  Record<
    SpeechProviderId,
    (settings: SpeechModelSettings, fetch: ProviderFetch) => SpeechModel
  >
> = {
  elevenlabs: (settings, fetch) =>
    createElevenLabs({
      apiKey: Redacted.value(settings.apiKey),
      fetch,
    }).speech(settings.model),
  fal: (settings, fetch) =>
    createFal(audioOptions(settings, fetch)).speech(settings.model),
  google: (settings, fetch) =>
    createGoogle(audioOptions(settings, fetch)).speech(settings.model),
  mistral: (settings, fetch) =>
    createMistral(audioOptions(settings, fetch)).speech(settings.model),
  openai: (settings, fetch) =>
    createOpenAI(audioOptions(settings, fetch)).speech(settings.model),
  xai: (settings, fetch) => createXai(audioOptions(settings, fetch)).speech(),
};

// Each provider's own transcription API, the file sent as its bytes.
const transcriptionBuilders: Readonly<
  Record<
    TranscriptionProviderId,
    (
      settings: TranscriptionModelSettings,
      fetch: ProviderFetch
    ) => TranscriptionModel
  >
> = {
  elevenlabs: (settings, fetch) =>
    createElevenLabs({
      apiKey: Redacted.value(settings.apiKey),
      fetch,
    }).transcription(settings.model),
  fal: (settings, fetch) =>
    createFal(audioOptions(settings, fetch)).transcription(settings.model),
  google: (settings, fetch) =>
    createGoogle(audioOptions(settings, fetch)).transcription(settings.model),
  groq: (settings, fetch) =>
    createGroq(audioOptions(settings, fetch)).transcription(settings.model),
  mistral: (settings, fetch) =>
    createMistral(audioOptions(settings, fetch)).transcription(settings.model),
  openai: (settings, fetch) =>
    createOpenAI(audioOptions(settings, fetch)).transcription(settings.model),
  xai: (settings, fetch) =>
    createXai(audioOptions(settings, fetch)).transcription(settings.model),
};

/**
 * The AI SDK's speech model for a workspace's speech provider, sending
 * its requests through `fetch`, the guarded one. Built for each call,
 * never cached. The key leaves `Redacted` here alone.
 */
export const speechModelOf = (
  settings: SpeechModelSettings,
  fetch: ProviderFetch
): SpeechModel => speechBuilders[settings.provider](settings, fetch);

/**
 * The AI SDK's transcription model for a workspace's transcription
 * provider, sending its requests through `fetch`, the guarded one. Built
 * for each call, never cached. The key leaves `Redacted` here alone.
 */
export const transcriptionModelOf = (
  settings: TranscriptionModelSettings,
  fetch: ProviderFetch
): TranscriptionModel =>
  transcriptionBuilders[settings.provider](settings, fetch);
