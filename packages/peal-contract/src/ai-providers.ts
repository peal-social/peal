import { Schema } from "effect";

/**
 * The AI providers Peal knows by name, for the writing assistant, the
 * agent, and the images, videos and audio it makes: each speaks its own
 * API, or the chat completions API, which the server's adapter for it
 * sends. What each one offers is `aiProviders`' to say: ElevenLabs and
 * fal write no text, and Shotstack composes videos alone. `openai-compatible` is any other endpoint that
 * serves `/chat/completions` with a strict JSON schema. New providers
 * join the end of the list.
 */
export const AiProviderIdSchema = Schema.Literals([
  "anthropic",
  "openai",
  "google",
  "mistral",
  "xai",
  "groq",
  "togetherai",
  "deepseek",
  "openrouter",
  "cerebras",
  "fireworks",
  "openai-compatible",
  "elevenlabs",
  "fal",
  "shotstack",
]).annotate({ identifier: "AiProvider" });

export type AiProviderId = typeof AiProviderIdSchema.Type;

/**
 * The providers Peal makes images with: each speaks its own images API,
 * which the server's adapter for it sends. `openai-compatible` is any
 * other endpoint that serves `/images/generations`.
 */
export const AiImageProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "xai",
  "togetherai",
  "openai-compatible",
  "fal",
]).annotate({ identifier: "AiImageProvider" });

export type AiImageProviderId = typeof AiImageProviderIdSchema.Type;

/**
 * The providers Peal makes videos with, with the workspace's own key: each
 * speaks its own video API, which the server's adapter for it sends.
 */
export const AiVideoProviderIdSchema = Schema.Literals([
  "google",
  "xai",
]).annotate({ identifier: "AiVideoProvider" });

export type AiVideoProviderId = typeof AiVideoProviderIdSchema.Type;

/**
 * The providers Peal makes voice-overs with, with the workspace's own key:
 * each speaks its own speech API, which the server's adapter for it sends.
 */
export const AiSpeechProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "mistral",
  "xai",
  "elevenlabs",
  "fal",
]).annotate({ identifier: "AiSpeechProvider" });

export type AiSpeechProviderId = typeof AiSpeechProviderIdSchema.Type;

/**
 * The providers Peal transcribes audio and videos with, with the
 * workspace's own key: each speaks its own transcription API, which the
 * server's adapter for it sends.
 */
export const AiTranscriptionProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "mistral",
  "xai",
  "groq",
  "elevenlabs",
  "fal",
]).annotate({ identifier: "AiTranscriptionProvider" });

export type AiTranscriptionProviderId =
  typeof AiTranscriptionProviderIdSchema.Type;

/**
 * The services Peal composes videos with, with the workspace's own key:
 * Shotstack's Edit API, which renders a timeline of the workspace's own
 * files. It is no AI, but a workspace connects it and chooses it as it
 * does its AI providers.
 */
export const AiCompositionProviderIdSchema = Schema.Literals([
  "shotstack",
]).annotate({ identifier: "AiCompositionProvider" });

export type AiCompositionProviderId = typeof AiCompositionProviderIdSchema.Type;

/**
 * What a workspace asks of its AI providers, one provider and model each:
 * `text`, the writing assistant's and the agent's language model,
 * `image`, the images it makes, `video`, the videos it makes, `speech`,
 * the voice-overs it makes, `transcription`, the transcripts of its
 * audio and videos, and `composition`, the slide videos composed from its
 * own files: no AI, as the service renders what it is given and takes no
 * model, but chosen as the others are. New uses join the end of the list;
 * a client meets a use it does not know as one to leave alone.
 */
export const AiCapabilitySchema = Schema.Literals([
  "text",
  "image",
  "video",
  "speech",
  "transcription",
  "composition",
]).annotate({
  identifier: "AiCapability",
});

export type AiCapability = typeof AiCapabilitySchema.Type;

/** Every use, in the order clients list them. */
export const aiCapabilities: readonly AiCapability[] =
  AiCapabilitySchema.literals;

/** What a provider offers for writing text, when it does. */
export interface AiTextOffer {
  /**
   * Where its API is reached: for Anthropic, the address `/v1/messages`
   * follows; for the others, the one `/chat/completions` follows. Null
   * for `openai-compatible`, whose address must be given.
   */
  readonly baseUrl: string | null;
  /** Models to suggest, newest or recommended first. Any other may be typed. */
  readonly models: readonly string[];
}

/** The three aspects Peal asks images in. */
export type AiImageAspect = "landscape" | "portrait" | "square";

/**
 * How a provider is asked for an image's dimensions: `size`, its width and
 * height in pixels (`1536x1024`), or `aspectRatio`, the ratio of its
 * sides (`3:2`), with the value asked for each of Peal's aspects.
 */
export interface AiImageDimensions {
  readonly as: "aspectRatio" | "size";
  readonly values: Readonly<Record<AiImageAspect, string>>;
}

/** What a provider offers for making images, when it does. */
export interface AiImageOffer {
  /**
   * Where its images API is reached; null for `openai-compatible`, whose
   * address, which `/images/generations` follows, must be given.
   */
  readonly baseUrl: string | null;
  /** Models to suggest, newest or recommended first. Any other may be typed. */
  readonly models: readonly string[];
  readonly dimensions: AiImageDimensions;
}

/**
 * What a provider offers for making videos, when it does: the ratio asked
 * for each of Peal's aspects (null for one it does not make), whether a
 * picture may start the video, and the lengths it takes in whole seconds
 * (null when it takes none: the provider then picks the length).
 */
export interface AiVideoOffer {
  readonly aspects: Readonly<Record<AiImageAspect, string | null>>;
  /** Where its video API is reached. */
  readonly baseUrl: string;
  readonly durations: { readonly max: number; readonly min: number } | null;
  /** Whether an image of the library may be the video's first frame. */
  readonly imageInput: boolean;
  /** Models to suggest, newest or recommended first. Any other may be typed. */
  readonly models: readonly string[];
}

/**
 * What a provider offers for voice-overs, when it does: the voices to
 * suggest, newest or recommended first, or null when Peal sends none (the
 * model's own voice speaks). With a list, any other voice the provider
 * knows may be typed; an empty list suggests none, and no voice sent
 * leaves the provider's default.
 */
export interface AiSpeechOffer {
  /** Where its speech API is reached. */
  readonly baseUrl: string;
  /** Models to suggest, newest or recommended first. Any other may be typed. */
  readonly models: readonly string[];
  readonly voices: readonly string[] | null;
}

/** What a provider offers for transcripts, when it does. */
export interface AiTranscriptionOffer {
  /** Where its transcription API is reached. */
  readonly baseUrl: string;
  /** Models to suggest, newest or recommended first. Any other may be typed. */
  readonly models: readonly string[];
}

/**
 * What a service offers for composing slide videos, when it does: its
 * production address, which renders with the account's credits and no
 * watermark, and its sandbox, free and always watermarked, which answers
 * the account's sandbox key. A connection keeps one or the other. It takes
 * no model.
 */
export interface AiCompositionOffer {
  /** Where its production API is reached. */
  readonly baseUrl: string;
  /** Where its sandbox is reached. */
  readonly sandboxUrl: string;
}

/** A provider as clients name and offer it. */
export interface AiProvider {
  /**
   * Where the provider is reached, which a workspace's connection to it
   * keeps (a proxy's in its place, when the workspace gives one): each
   * use's own address is this one followed by what the use's `baseUrl`
   * adds to it (`aiCapabilityAddress`). Null for `openai-compatible`,
   * whose address must be given.
   */
  readonly baseUrl: string | null;
  /** Null for a service Peal composes no videos with. */
  readonly composition: AiCompositionOffer | null;
  /**
   * Whether the provider is reached at `baseUrl` alone (or at its
   * sandbox, `composition.sandboxUrl`, for a service that has one): its
   * package sends to its own addresses, so a connection takes no other
   * (no proxy).
   */
  readonly fixedAddress: boolean;
  /** Null for a provider Peal makes no images with. */
  readonly image: AiImageOffer | null;
  readonly name: string;
  /** Null for a provider Peal makes no voice-overs with. */
  readonly speech: AiSpeechOffer | null;
  /** Null for a provider Peal writes no text with. */
  readonly text: AiTextOffer | null;
  /** Null for a provider Peal transcribes nothing with. */
  readonly transcription: AiTranscriptionOffer | null;
  /** Null for a provider Peal makes no videos with. */
  readonly video: AiVideoOffer | null;
}

// Width by height, as OpenAI's images API and the endpoints that speak it
// take them: the sizes current models make.
const pixelSizes: AiImageDimensions = {
  as: "size",
  values: {
    landscape: "1536x1024",
    portrait: "1024x1536",
    square: "1024x1024",
  },
};

// The same dimensions as ratios, for an API that takes no size.
const ratios: AiImageDimensions = {
  as: "aspectRatio",
  values: { landscape: "3:2", portrait: "2:3", square: "1:1" },
};

/**
 * What each provider Peal makes images with offers: its images API's
 * address, models to suggest and the dimensions it takes, each checked in its
 * package's documentation (November 2026). Models go stale: check each
 * one's models page when this list changes, never a deprecated id.
 */
export const aiImageProviders: Readonly<
  Record<AiImageProviderId, AiImageOffer>
> = {
  google: {
    // Gemini's own API, not the chat completions one its text is
    // offered at; it takes ratios alone.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      "gemini-nano-banana-2.1",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ],
    dimensions: ratios,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-image-2.6-flare", "gpt-image-2.6-sunburst"],
    dimensions: pixelSizes,
  },
  // fal's FLUX models, which take its own named sizes: its package sends
  // `landscape_4_3`, `portrait_4_3` and `square_hd` for these ratios.
  fal: {
    baseUrl: "https://fal.run",
    models: ["fal-ai/flux/dev", "fal-ai/flux/schnell"],
    dimensions: {
      as: "aspectRatio",
      values: { landscape: "4:3", portrait: "3:4", square: "1:1" },
    },
  },
  "openai-compatible": { baseUrl: null, models: [], dimensions: pixelSizes },
  togetherai: {
    // Its images API's own address, which is not the one its text is
    // offered at.
    baseUrl: "https://api.together.xyz/v1",
    models: [
      "black-forest-labs/FLUX.2-pro",
      "black-forest-labs/FLUX.1-schnell",
    ],
    dimensions: pixelSizes,
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-imagine-image-2.0", "grok-imagine-image-pro"],
    dimensions: ratios,
  },
};

/**
 * What each provider Peal makes videos with offers, each checked in its
 * package's sources and documentation (November 2026): Gemini's Veo
 * models at its own API's `predictLongRunning`, which take a landscape or
 * a portrait ratio and a first frame as bytes, the length left to the
 * model; xAI's Grok Imagine video models, which take the three ratios, a
 * first frame and 1 to 15 seconds. Models go stale: check each one's
 * models page when this list changes, never a deprecated id.
 */
export const aiVideoProviders: Readonly<
  Record<AiVideoProviderId, AiVideoOffer>
> = {
  google: {
    aspects: { landscape: "16:9", portrait: "9:16", square: null },
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    durations: null,
    imageInput: true,
    models: [
      "veo-3.1-generate-preview",
      "veo-3.1-fast-generate-preview",
      "veo-3.1-lite-generate-preview",
    ],
  },
  xai: {
    aspects: { landscape: "16:9", portrait: "9:16", square: "1:1" },
    baseUrl: "https://api.x.ai/v1",
    durations: { max: 15, min: 1 },
    imageInput: true,
    models: ["grok-imagine-video-1.5", "grok-imagine-video"],
  },
};

/**
 * What each provider Peal makes voice-overs with offers, each checked in
 * its package's documentation and sources (November 2026): its speech
 * API's address, models and voices. OpenAI, xAI, Mistral and ElevenLabs
 * answer MP3, Gemini WAV, fal's MiniMax models a file it links to. xAI's
 * speech API takes no model: `default` names it. fal's models take their
 * voice in options Peal does not send. Models go stale: check each one's
 * models page when this list changes, never a deprecated id.
 */
export const aiSpeechProviders: Readonly<
  Record<AiSpeechProviderId, AiSpeechOffer>
> = {
  elevenlabs: {
    baseUrl: "https://api.elevenlabs.io",
    models: ["eleven_multilingual_v2", "eleven_v3", "eleven_flash_v2_5"],
    // A voice of the account's library, by its id; none sends the
    // package's default voice.
    voices: [],
  },
  fal: {
    baseUrl: "https://fal.run",
    models: ["fal-ai/minimax/speech-02-hd", "fal-ai/minimax/speech-02-turbo"],
    voices: null,
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"],
    voices: ["Kore", "Puck", "Zephyr", "Charon"],
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    models: ["voxtral-mini-tts-3-0"],
    voices: ["gb_jane_neutral"],
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"],
    voices: [
      "alloy",
      "ash",
      "coral",
      "echo",
      "fable",
      "onyx",
      "nova",
      "sage",
      "shimmer",
    ],
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    models: ["default"],
    voices: ["eve", "ara", "rex", "sal", "leo"],
  },
};

/**
 * What each provider Peal transcribes with offers, each checked in its
 * package's documentation and sources (November 2026): its transcription
 * API's address and models. Models go stale: check each one's models page
 * when this list changes, never a deprecated id.
 */
export const aiTranscriptionProviders: Readonly<
  Record<AiTranscriptionProviderId, AiTranscriptionOffer>
> = {
  elevenlabs: {
    baseUrl: "https://api.elevenlabs.io",
    models: ["scribe_v2", "scribe_v1"],
  },
  fal: { baseUrl: "https://fal.run", models: ["wizper", "whisper"] },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-3.5-transcribe"],
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["whisper-large-v3-turbo", "whisper-large-v3"],
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    models: ["voxtral-mini-transcribe-3-0", "voxtral-small-transcribe-3-0"],
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"],
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-voice-transcribe-2.0"],
  },
};

/**
 * What each service Peal composes slide videos with offers, checked in its
 * documentation (November 2026): Shotstack's Edit API, `v1` in
 * production, `stage` its sandbox, each answering its own key in the
 * `x-api-key` header.
 */
export const aiCompositionProviders: Readonly<
  Record<AiCompositionProviderId, AiCompositionOffer>
> = {
  shotstack: {
    baseUrl: "https://api.shotstack.io/edit/v1",
    sandboxUrl: "https://api.shotstack.io/edit/stage",
  },
};

/**
 * Each provider's name and, for text and images, its default address and
 * models to suggest, each checked in its own documentation (November
 * 2026). Models go stale: check each one's models page when this list
 * changes, never a deprecated id.
 */
export const aiProviders: Readonly<Record<AiProviderId, AiProvider>> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "Anthropic",
    speech: null,
    text: {
      baseUrl: "https://api.anthropic.com",
      models: [
        "claude-sonnet-5-5",
        "claude-opus-5-5",
        "claude-haiku-5-5",
        "claude-fable-5-2",
      ],
    },
    transcription: null,
    video: null,
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "Cerebras",
    speech: null,
    text: { baseUrl: "https://api.cerebras.ai/v1", models: ["gpt-oss-120b"] },
    transcription: null,
    video: null,
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "DeepSeek",
    speech: null,
    text: {
      baseUrl: "https://api.deepseek.com",
      models: ["deepseek-v4-pro", "deepseek-flash"],
    },
    transcription: null,
    video: null,
  },
  fireworks: {
    baseUrl: "https://api.fireworks.ai/inference/v1",
    composition: null,
    fixedAddress: false,
    // Its image models take a size or a ratio, each its own: none is
    // offered until one is chosen.
    image: null,
    name: "Fireworks AI",
    speech: null,
    text: {
      baseUrl: "https://api.fireworks.ai/inference/v1",
      models: ["accounts/fireworks/models/kimi-k2p5"],
    },
    transcription: null,
    video: null,
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    composition: null,
    fixedAddress: false,
    image: aiImageProviders.google,
    name: "Google Gemini",
    speech: aiSpeechProviders.google,
    text: {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      models: [
        "gemini-4-neon",
        "gemini-4-carbon",
        "gemini-4-hydrogen",
        "gemini-4-argon",
      ],
    },
    transcription: aiTranscriptionProviders.google,
    video: aiVideoProviders.google,
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "Groq",
    // Strict structured output on its open models alone.
    speech: null,
    text: {
      baseUrl: "https://api.groq.com/openai/v1",
      models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    },
    transcription: aiTranscriptionProviders.groq,
    video: null,
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "Mistral",
    speech: aiSpeechProviders.mistral,
    text: {
      baseUrl: "https://api.mistral.ai/v1",
      models: ["mistral-large-latest", "mistral-small-latest"],
    },
    transcription: aiTranscriptionProviders.mistral,
    video: null,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    composition: null,
    fixedAddress: false,
    image: aiImageProviders.openai,
    name: "OpenAI",
    speech: aiSpeechProviders.openai,
    text: {
      baseUrl: "https://api.openai.com/v1",
      models: ["gpt-6.2-astra", "gpt-6.2-sol"],
    },
    transcription: aiTranscriptionProviders.openai,
    video: null,
  },
  "openai-compatible": {
    baseUrl: null,
    composition: null,
    fixedAddress: false,
    image: aiImageProviders["openai-compatible"],
    name: "Another provider",
    speech: null,
    text: { baseUrl: null, models: [] },
    transcription: null,
    video: null,
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    composition: null,
    fixedAddress: false,
    image: null,
    name: "OpenRouter",
    speech: null,
    text: {
      baseUrl: "https://openrouter.ai/api/v1",
      models: ["anthropic/claude-sonnet-5.5", "google/gemini-4-neon"],
    },
    transcription: null,
    video: null,
  },
  togetherai: {
    baseUrl: "https://api.together.xyz/v1",
    composition: null,
    fixedAddress: false,
    image: aiImageProviders.togetherai,
    name: "Together AI",
    speech: null,
    text: {
      baseUrl: "https://api.together.xyz/v1",
      models: [
        "moonshotai/Kimi-K3.1-Pro",
        "zai-org/GLM-5.3",
        "openai/gpt-oss-120b",
      ],
    },
    transcription: null,
    video: null,
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    composition: null,
    fixedAddress: false,
    image: aiImageProviders.xai,
    name: "xAI",
    speech: aiSpeechProviders.xai,
    text: { baseUrl: "https://api.x.ai/v1", models: ["grok-4.7", "grok-4.6"] },
    transcription: aiTranscriptionProviders.xai,
    video: aiVideoProviders.xai,
  },
  elevenlabs: {
    baseUrl: "https://api.elevenlabs.io",
    composition: null,
    // Its package sends to `api.elevenlabs.io` alone.
    fixedAddress: true,
    image: null,
    name: "ElevenLabs",
    speech: aiSpeechProviders.elevenlabs,
    text: null,
    transcription: aiTranscriptionProviders.elevenlabs,
    video: null,
  },
  fal: {
    baseUrl: "https://fal.run",
    composition: null,
    // Its package sends speech and transcripts to fal's own addresses
    // (`fal.run`, `queue.fal.run`), whatever the address given.
    fixedAddress: true,
    image: aiImageProviders.fal,
    name: "fal",
    speech: aiSpeechProviders.fal,
    text: null,
    transcription: aiTranscriptionProviders.fal,
    // Its video models each take their own settings, which its package
    // leaves to each model: none is offered until one is checked.
    video: null,
  },
  shotstack: {
    baseUrl: "https://api.shotstack.io/edit/v1",
    composition: aiCompositionProviders.shotstack,
    // Its production API or its sandbox, nowhere else: each answers the
    // account's own key for it.
    fixedAddress: true,
    image: null,
    name: "Shotstack",
    speech: null,
    text: null,
    transcription: null,
    video: null,
  },
};

/**
 * The API a provider speaks, as a text provider's `kind` says it: the
 * Messages API for Anthropic, chat completions for every other.
 */
export const aiProviderKind = (
  provider: AiProviderId
): "anthropic" | "openai-compatible" =>
  provider === "anthropic" ? "anthropic" : "openai-compatible";

/** The provider a `kind` alone names, for a row saved before `provider`. */
export const aiProviderOfKind = (
  kind: "anthropic" | "openai-compatible"
): AiProviderId => kind;

/** What a provider offers for a use, or null when it does not offer it. */
export const aiOfferOf = (
  provider: AiProviderId,
  capability: AiCapability
):
  | AiCompositionOffer
  | AiImageOffer
  | AiSpeechOffer
  | AiTextOffer
  | AiTranscriptionOffer
  | AiVideoOffer
  | null => aiProviders[provider][capability];

/** Whether a provider offers a use: the catalogue says, never a workspace. */
export const aiProviderOffers = (
  provider: AiProviderId,
  capability: AiCapability
): boolean => aiOfferOf(provider, capability) !== null;

// What a use's own address adds to its provider's: `/openai` for
// Gemini's text, which it serves on the chat completions API there;
// nothing for the others.
const pathOf = (provider: AiProviderId, capability: AiCapability): string => {
  const base = aiProviders[provider].baseUrl;
  const own = aiOfferOf(provider, capability)?.baseUrl ?? null;

  return base !== null && own !== null && own.startsWith(base)
    ? own.slice(base.length)
    : "";
};

/**
 * Where a use of a provider is reached from the address a workspace's
 * connection keeps: that address, followed by what the use's own adds to
 * the provider's (`https://generativelanguage.googleapis.com/v1beta`
 * gives Gemini's text at `…/v1beta/openai`).
 */
export const aiCapabilityAddress = (
  provider: AiProviderId,
  capability: AiCapability,
  address: string
): string => `${address}${pathOf(provider, capability)}`;

/**
 * The addresses a connection to a provider reached at its own alone
 * (`fixedAddress`) takes: its `baseUrl`, and its sandbox's for a service
 * that has one. Empty for any other provider, which takes any public
 * address.
 */
export const aiFixedAddresses = (provider: AiProviderId): readonly string[] => {
  const { baseUrl, composition, fixedAddress } = aiProviders[provider];

  if (!fixedAddress || baseUrl === null) {
    return [];
  }

  return composition === null ? [baseUrl] : [baseUrl, composition.sandboxUrl];
};
