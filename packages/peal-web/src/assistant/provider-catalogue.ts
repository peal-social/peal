import {
  aiCapabilities,
  aiOfferOf,
  aiProviderOffers,
  aiProviders,
} from "peal-contract/ai-providers";
import type { AiCapability, AiProviderId } from "peal-contract/ai-providers";

/**
 * The order the settings list providers in, Anthropic's API first and
 * another provider (`openai-compatible`) last. Every provider of
 * `peal-contract/ai-providers` is here once (the catalogue's test checks
 * it), so a new provider is added there, and here in its place.
 */
export const providerOrder = [
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
  "elevenlabs",
  "fal",
  "shotstack",
  "openai-compatible",
] as const satisfies readonly AiProviderId[];

/** The uses the settings list, in the contract's order. */
export const capabilityOrder: readonly AiCapability[] = aiCapabilities;

/** Whether a provider is the one with no address of its own. */
export const isAnotherProvider = (provider: AiProviderId): boolean =>
  aiProviders[provider].baseUrl === null;

/** Where a provider is reached when none is typed; null for another one. */
export const defaultAddressOf = (provider: AiProviderId): string | null =>
  aiProviders[provider].baseUrl;

/**
 * The models to suggest for a provider's use, newest or recommended
 * first; none for another provider, whose model is typed.
 */
export const modelsFor = (
  provider: AiProviderId,
  capability: AiCapability
): readonly string[] => {
  const offer = aiOfferOf(provider, capability);

  return offer !== null && "models" in offer ? offer.models : [];
};

/**
 * Whether a use takes a model: every one but `composition`, whose service
 * renders what it is given, so its row shows the provider alone.
 */
export const takesModel = (capability: AiCapability): boolean =>
  capability !== "composition";

/** Whether a provider offers a use, as the catalogue says. */
export const offers = (
  provider: AiProviderId,
  capability: AiCapability
): boolean => aiProviderOffers(provider, capability);

/** The providers a workspace may still connect, in the settings' order. */
export const connectable = (
  connected: readonly AiProviderId[]
): readonly AiProviderId[] =>
  providerOrder.filter((provider) => !connected.includes(provider));
