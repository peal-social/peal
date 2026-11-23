import { Schema } from "effect";

import {
  speechOffers,
  SpeechProviderIdSchema,
  transcriptionAddresses,
  TranscriptionProviderIdSchema,
} from "./audio-provider.ts";
import type {
  SpeechProviderId,
  TranscriptionProviderId,
} from "./audio-provider.ts";
import {
  compositionOffers,
  CompositionProviderIdSchema,
} from "./composition-provider.ts";
import type { CompositionProviderId } from "./composition-provider.ts";
import {
  imageProviderAddresses,
  ImageProviderIdSchema,
} from "./image-provider.ts";
import type { ImageProviderId } from "./image-provider.ts";
import { providerAddresses, TextProviderIdSchema } from "./text-provider.ts";
import type { TextProviderId } from "./text-provider.ts";
import { videoOffers, VideoProviderIdSchema } from "./video-provider.ts";
import type { VideoProviderId } from "./video-provider.ts";

/**
 * What a workspace asks of its own providers, one provider and model
 * each (`AiCapability` in `peal-contract/ai-providers`, kept equal by
 * `test/assistant/api/contract.test.ts`). A later use joins the list;
 * a row naming one this release does not know is left alone.
 */
export const AiCapabilitySchema = Schema.Literals([
  "text",
  "image",
  "video",
  "speech",
  "transcription",
  "composition",
]);

export type AiCapability = typeof AiCapabilitySchema.Type;

/** Every use, in the order the contract lists them. */
export const aiCapabilities: readonly AiCapability[] =
  AiCapabilitySchema.literals;

/**
 * A provider a workspace connects: any of the catalogue's
 * (`AiProviderIdSchema` in `peal-contract/ai-providers`, in its order),
 * whether or not it writes text: ElevenLabs and fal make media alone,
 * and Shotstack composes slide videos alone.
 */
export const ConnectedProviderIdSchema = Schema.Literals([
  ...TextProviderIdSchema.literals,
  "elevenlabs",
  "fal",
  "shotstack",
]);

export type ConnectedProviderId = typeof ConnectedProviderIdSchema.Type;

const isTextProvider = Schema.is(TextProviderIdSchema);

const isImageProvider = Schema.is(ImageProviderIdSchema);

const isVideoProvider = Schema.is(VideoProviderIdSchema);

const isSpeechProvider = Schema.is(SpeechProviderIdSchema);

const isTranscriptionProvider = Schema.is(TranscriptionProviderIdSchema);

const isCompositionProvider = Schema.is(CompositionProviderIdSchema);

const offers: Readonly<
  Record<AiCapability, (provider: ConnectedProviderId) => boolean>
> = {
  composition: isCompositionProvider,
  image: isImageProvider,
  speech: isSpeechProvider,
  text: isTextProvider,
  transcription: isTranscriptionProvider,
  video: isVideoProvider,
};

/**
 * Whether a provider serves a use, as the catalogue says: the text
 * providers write text, the image providers make images, and so on.
 */
export const offersCapability = (
  provider: ConnectedProviderId,
  capability: AiCapability
): boolean => offers[capability](provider);

/** The provider as a text provider, when it writes text. */
export const asTextProvider = (
  provider: ConnectedProviderId
): TextProviderId | null => (isTextProvider(provider) ? provider : null);

/** The provider as an image provider, when it is one. */
export const asImageProvider = (
  provider: ConnectedProviderId
): ImageProviderId | null => (isImageProvider(provider) ? provider : null);

/** The provider as a video provider, when it is one. */
export const asVideoProvider = (
  provider: ConnectedProviderId
): VideoProviderId | null => (isVideoProvider(provider) ? provider : null);

/** The provider as a speech provider, when it is one. */
export const asSpeechProvider = (
  provider: ConnectedProviderId
): SpeechProviderId | null => (isSpeechProvider(provider) ? provider : null);

/** The provider as a composition service, when it is one. */
export const asCompositionProvider = (
  provider: ConnectedProviderId
): CompositionProviderId | null =>
  isCompositionProvider(provider) ? provider : null;

/** The provider as a transcription provider, when it is one. */
export const asTranscriptionProvider = (
  provider: ConnectedProviderId
): TranscriptionProviderId | null =>
  isTranscriptionProvider(provider) ? provider : null;

/**
 * Where each provider is reached when the workspace gives no address,
 * which its connection keeps (`baseUrl` of `aiProviders` in the
 * contract's catalogue); `openai-compatible` has none.
 */
export const connectionAddresses: Readonly<
  Record<ConnectedProviderId, string | null>
> = {
  anthropic: "https://api.anthropic.com",
  cerebras: "https://api.cerebras.ai/v1",
  deepseek: "https://api.deepseek.com",
  elevenlabs: "https://api.elevenlabs.io",
  fal: "https://fal.run",
  fireworks: "https://api.fireworks.ai/inference/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  openai: "https://api.openai.com/v1",
  "openai-compatible": null,
  openrouter: "https://openrouter.ai/api/v1",
  shotstack: "https://api.shotstack.io/edit/v1",
  togetherai: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1",
};

/**
 * The providers reached at their own address alone (`fixedAddress` in
 * the catalogue): their packages send to their own hosts whatever the
 * address given, so a connection takes no other, and a key never goes
 * where its connection does not say.
 */
export const fixedAddressProviders: ReadonlySet<ConnectedProviderId> = new Set([
  "elevenlabs",
  "fal",
  "shotstack",
]);

/**
 * The addresses a provider reached at its own alone takes: its own, and
 * its sandbox's for a composition service (`aiFixedAddresses` in the
 * contract's catalogue).
 */
export const fixedAddressesOf = (
  provider: ConnectedProviderId
): readonly string[] => {
  const own = connectionAddresses[provider];
  const composition = asCompositionProvider(provider);

  if (!fixedAddressProviders.has(provider) || own === null) {
    return [];
  }

  return composition === null
    ? [own]
    : [own, compositionOffers[composition].sandboxUrl];
};

/**
 * The model a provider's test asks when the workspace writes no text
 * with it: the first the catalogue suggests (`text.models` of
 * `aiProviders`), none for `openai-compatible` and for a provider that
 * writes no text.
 */
export const firstTextModels: Readonly<
  Record<ConnectedProviderId, string | null>
> = {
  anthropic: "claude-sonnet-5-5",
  cerebras: "gpt-oss-120b",
  deepseek: "deepseek-v4-pro",
  elevenlabs: null,
  fal: null,
  fireworks: "accounts/fireworks/models/kimi-k2p5",
  google: "gemini-4-neon",
  groq: "openai/gpt-oss-120b",
  mistral: "mistral-large-latest",
  openai: "gpt-6.2-astra",
  "openai-compatible": null,
  openrouter: "anthropic/claude-sonnet-5.5",
  shotstack: null,
  togetherai: "moonshotai/Kimi-K3.1-Pro",
  xai: "grok-4.7",
};

const ownAddresses: Readonly<
  Record<AiCapability, (provider: ConnectedProviderId) => string | null>
> = {
  composition: (provider) => {
    const composition = asCompositionProvider(provider);

    return composition === null ? null : compositionOffers[composition].baseUrl;
  },
  image: (provider) => {
    const image = asImageProvider(provider);

    return image === null ? null : imageProviderAddresses[image];
  },
  speech: (provider) => {
    const speech = asSpeechProvider(provider);

    return speech === null ? null : speechOffers[speech].baseUrl;
  },
  text: (provider) => {
    const text = asTextProvider(provider);

    return text === null ? null : providerAddresses[text];
  },
  transcription: (provider) => {
    const transcription = asTranscriptionProvider(provider);

    return transcription === null
      ? null
      : transcriptionAddresses[transcription];
  },
  video: (provider) => {
    const video = asVideoProvider(provider);

    return video === null ? null : videoOffers[video].baseUrl;
  },
};

// What a use's own address adds to its provider's: `/openai` for
// Gemini's text, which it serves on the chat completions API there.
const pathOf = (
  provider: ConnectedProviderId,
  capability: AiCapability
): string => {
  const base = connectionAddresses[provider];
  const own = ownAddresses[capability](provider);

  return base !== null && own?.startsWith(base) === true
    ? own.slice(base.length)
    : "";
};

/**
 * Where a use of a connected provider is reached: the connection's
 * address, followed by what the use's own address adds to the
 * provider's.
 */
export const capabilityAddressOf = (
  provider: ConnectedProviderId,
  capability: AiCapability,
  address: string
): string => `${address}${pathOf(provider, capability)}`;

/**
 * The connection's address for a use's address, as the text and image
 * provider endpoints are given it: without what the use adds, when it
 * ends with it.
 */
export const connectionAddressOf = (
  provider: ConnectedProviderId,
  capability: AiCapability,
  address: string
): string => {
  const path = pathOf(provider, capability);

  return path !== "" && address.endsWith(path)
    ? address.slice(0, -path.length)
    : address;
};
