import { Schema } from "effect";

/**
 * The providers Peal makes voice-overs with (`aiSpeechProviders` in
 * `peal-contract/ai-providers`, kept equal by
 * `test/assistant/api/contract.test.ts`), each with an adapter of its own.
 */
export const SpeechProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "mistral",
  "xai",
  "elevenlabs",
  "fal",
]);

export type SpeechProviderId = typeof SpeechProviderIdSchema.Type;

/**
 * The providers Peal transcribes with (`aiTranscriptionProviders` in
 * `peal-contract/ai-providers`, kept equal by the same test).
 */
export const TranscriptionProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "mistral",
  "xai",
  "groq",
  "elevenlabs",
  "fal",
]);

export type TranscriptionProviderId = typeof TranscriptionProviderIdSchema.Type;

/** What a provider offers for voice-overs, as the catalogue says. */
export interface SpeechOffer {
  /** Where its speech API is reached when no address is given. */
  readonly baseUrl: string;
  /** Whether a voice may be named: false when the model speaks with its own. */
  readonly takesVoice: boolean;
}

/** Each provider's speech offer, as the contract's catalogue states it. */
export const speechOffers: Readonly<Record<SpeechProviderId, SpeechOffer>> = {
  elevenlabs: { baseUrl: "https://api.elevenlabs.io", takesVoice: true },
  fal: { baseUrl: "https://fal.run", takesVoice: false },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    takesVoice: true,
  },
  mistral: { baseUrl: "https://api.mistral.ai/v1", takesVoice: true },
  openai: { baseUrl: "https://api.openai.com/v1", takesVoice: true },
  xai: { baseUrl: "https://api.x.ai/v1", takesVoice: true },
};

/** Where each provider's transcription API is reached when no address is given. */
export const transcriptionAddresses: Readonly<
  Record<TranscriptionProviderId, string>
> = {
  elevenlabs: "https://api.elevenlabs.io",
  fal: "https://fal.run",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
};
