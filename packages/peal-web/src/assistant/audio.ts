import { Match } from "effect";
import type {
  AssistantInputRejected,
  AssistantTranscriptionsStatus,
  AssistantVoiceoversStatus,
  AudioAllowanceReached,
  AudioProviderFailed,
  AudioUnavailable,
  Forbidden,
  Media,
  MediaNotFound,
  MediaStoreUnavailable,
  PlanLimitReached,
  TooManyRequests,
  TranscriptionRejected,
  Unauthenticated,
  VoiceNotOffered,
  VoiceoverRequest,
  WorkspaceNotFound,
} from "peal-contract";
import { aiProviders } from "peal-contract/ai-providers";
import type { AiSpeechOffer } from "peal-contract/ai-providers";

// What the voice-over and transcript dialogs offer, from the providers
// the workspace chose and what the catalogue says each takes, and how a
// refusal reads.

/** What the chosen provider speaks with, or null when none is chosen. */
export const speechOfferOf = (
  voiceovers: Pick<AssistantVoiceoversStatus, "provider">
): AiSpeechOffer | null =>
  voiceovers.provider === null ? null : aiProviders[voiceovers.provider].speech;

/**
 * How the dialog asks for a voice: a list to choose from, a field to type
 * a voice's id in (a provider that takes any of its account's voices and
 * suggests none), or nothing (one whose model speaks with its own).
 */
export type VoiceField =
  | { readonly _tag: "choose"; readonly voices: readonly string[] }
  | { readonly _tag: "type" }
  | { readonly _tag: "none" };

export const voiceFieldOf = (offer: AiSpeechOffer): VoiceField => {
  if (offer.voices === null) {
    return { _tag: "none" };
  }

  return offer.voices.length === 0
    ? { _tag: "type" }
    : { _tag: "choose", voices: offer.voices };
};

/** The request the dialog sends: a blank voice is left out. */
export const voiceoverRequestOf = (
  text: string,
  voice: string
): VoiceoverRequest => {
  const named = voice.trim();

  return named === "" ? { text } : { text, voice: named };
};

/**
 * Whether a file can be transcribed: a ready audio or video file no
 * larger than the provider is sent.
 */
export const canTranscribe = (
  media: Pick<Media, "byteSize" | "kind" | "status">,
  transcriptions: Pick<AssistantTranscriptionsStatus, "available" | "maxBytes">
): boolean =>
  transcriptions.available &&
  (media.kind === "audio" || media.kind === "video") &&
  media.status._tag === "ready" &&
  media.byteSize <= transcriptions.maxBytes;

/** Why a voice-over or a transcript was not made, as the API declares it. */
export type AudioFailure =
  | AssistantInputRejected
  | AudioAllowanceReached
  | AudioProviderFailed
  | AudioUnavailable
  | Forbidden
  | MediaNotFound
  | MediaStoreUnavailable
  | PlanLimitReached
  | TooManyRequests
  | TranscriptionRejected
  | Unauthenticated
  | VoiceNotOffered
  | WorkspaceNotFound
  // The request failed in a way the API does not declare.
  | { readonly _tag: "Unexpected" };

/** The message of `Assistant.audio.errors` that says why. */
export type AudioFailureKey =
  | "allowance"
  | "empty"
  | "forbidden"
  | "generic"
  | "keyUnreadable"
  | "notAudio"
  | "notFound"
  | "notReady"
  | "provider"
  | "settings"
  | "storage"
  | "tooLarge"
  | "tooLong"
  | "unavailable"
  | "voiceNotOffered";

/** Which message tells the member why nothing was made. */
export const audioFailureKey = (failure: AudioFailure): AudioFailureKey =>
  Match.valueTags(failure, {
    AssistantInputRejected: ({ reason }): AudioFailureKey => reason,
    AudioAllowanceReached: (): AudioFailureKey => "allowance",
    AudioProviderFailed: ({ reason }): AudioFailureKey =>
      reason === "settingsRefused" ? "settings" : "provider",
    AudioUnavailable: ({ reason }): AudioFailureKey =>
      reason === "notSet" ? "unavailable" : "keyUnreadable",
    Forbidden: (): AudioFailureKey => "forbidden",
    MediaNotFound: (): AudioFailureKey => "notFound",
    MediaStoreUnavailable: (): AudioFailureKey => "generic",
    PlanLimitReached: (): AudioFailureKey => "storage",
    TooManyRequests: (): AudioFailureKey => "generic",
    TranscriptionRejected: ({ reason }): AudioFailureKey => reason,
    Unauthenticated: (): AudioFailureKey => "generic",
    Unexpected: (): AudioFailureKey => "generic",
    VoiceNotOffered: (): AudioFailureKey => "voiceNotOffered",
    WorkspaceNotFound: (): AudioFailureKey => "generic",
  });

/** Whether the refusal is the provider's settings, to fix in the assistant settings. */
export const isAudioSettingsRefusal = (failure: AudioFailure): boolean =>
  failure._tag === "AudioUnavailable" ||
  (failure._tag === "AudioProviderFailed" &&
    failure.reason === "settingsRefused");
