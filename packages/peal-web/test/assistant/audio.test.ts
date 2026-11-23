import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  AssistantInputRejected,
  AudioAllowanceReached,
  AudioProviderFailed,
  AudioUnavailable,
  TranscriptionRejected,
  VoiceNotOffered,
} from "peal-contract";
import { aiSpeechProviders } from "peal-contract/ai-providers";

import {
  audioFailureKey,
  canTranscribe,
  isAudioSettingsRefusal,
  speechOfferOf,
  voiceFieldOf,
  voiceoverRequestOf,
} from "#assistant/audio.ts";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const open = { available: true, maxBytes: 25_000_000 };

describe("the voice-over dialog", () => {
  it("offers the chosen provider's voices, a field, or nothing", () => {
    expect(speechOfferOf({ provider: null })).toBeNull();
    expect(speechOfferOf({ provider: "anthropic" })).toBeNull();
    expect(voiceFieldOf(aiSpeechProviders.openai)).toStrictEqual({
      _tag: "choose",
      voices: aiSpeechProviders.openai.voices,
    });
    expect(voiceFieldOf(aiSpeechProviders.elevenlabs)).toStrictEqual({
      _tag: "type",
    });
    expect(voiceFieldOf(aiSpeechProviders.fal)).toStrictEqual({
      _tag: "none",
    });
  });

  it("sends a voice only when one is named", () => {
    expect(voiceoverRequestOf("Hello.", " ")).toStrictEqual({
      text: "Hello.",
    });
    expect(voiceoverRequestOf("Hello.", " nova ")).toStrictEqual({
      text: "Hello.",
      voice: "nova",
    });
  });
});

describe("transcribing a file", () => {
  it("is offered on a ready audio or video file within the size", () => {
    const ready = { _tag: "ready" } as const;

    expect(
      canTranscribe({ byteSize: 10, kind: "audio", status: ready }, open)
    ).toBeTruthy();
    expect(
      canTranscribe({ byteSize: 10, kind: "video", status: ready }, open)
    ).toBeTruthy();
    expect(
      canTranscribe({ byteSize: 10, kind: "image", status: ready }, open)
    ).toBeFalsy();
    expect(
      canTranscribe(
        { byteSize: 30_000_000, kind: "audio", status: ready },
        open
      )
    ).toBeFalsy();
    expect(
      canTranscribe(
        { byteSize: 10, kind: "audio", status: ready },
        { ...open, available: false }
      )
    ).toBeFalsy();
  });
});

describe("why no voice-over or transcript was made", () => {
  it("reads each refusal", () => {
    expect(
      [
        new AssistantInputRejected({ maxLength: 4000, reason: "tooLong" }),
        new AudioAllowanceReached({
          capability: "speech",
          dailyLimit: 50,
          resetsAt: at,
        }),
        new AudioProviderFailed({
          capability: "speech",
          reason: "settingsRefused",
        }),
        new AudioProviderFailed({
          capability: "transcription",
          reason: "timedOut",
        }),
        new AudioUnavailable({ capability: "speech", reason: "notSet" }),
        new AudioUnavailable({
          capability: "transcription",
          reason: "keyUnreadable",
        }),
        new TranscriptionRejected({ maxBytes: 1, reason: "tooLarge" }),
        new VoiceNotOffered(),
      ].map(audioFailureKey)
    ).toStrictEqual([
      "tooLong",
      "allowance",
      "settings",
      "provider",
      "unavailable",
      "keyUnreadable",
      "tooLarge",
      "voiceNotOffered",
    ]);
    expect(
      isAudioSettingsRefusal(
        new AudioProviderFailed({
          capability: "speech",
          reason: "settingsRefused",
        })
      )
    ).toBeTruthy();
    expect(
      isAudioSettingsRefusal(
        new AudioProviderFailed({ capability: "speech", reason: "refused" })
      )
    ).toBeFalsy();
  });
});
