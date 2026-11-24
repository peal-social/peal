import { Effect } from "effect";
import {
  AudioAllowanceReached,
  AudioProviderFailed,
  AudioUnavailable,
  MediaStoreUnavailable,
} from "peal-contract";

import { forbidden } from "#shared/api/forbidden.ts";

/**
 * How the audio use case's failures that voice-overs and transcripts share
 * answer.
 */
export const audioFailures = {
  AudioExhausted: ({
    capability,
    dailyLimit,
    resetsAt,
  }: {
    readonly capability: "speech" | "transcription";
    readonly dailyLimit: number;
    readonly resetsAt: AudioAllowanceReached["resetsAt"];
  }) =>
    Effect.fail(
      new AudioAllowanceReached({ capability, dailyLimit, resetsAt })
    ),
  AudioFailed: ({
    capability,
    reason,
  }: {
    readonly capability: "speech" | "transcription";
    readonly reason: AudioProviderFailed["reason"];
  }) => Effect.fail(new AudioProviderFailed({ capability, reason })),
  AudioNotStored: () => Effect.fail(new MediaStoreUnavailable()),
  AudioUnavailable: ({
    capability,
    reason,
  }: {
    readonly capability: "speech" | "transcription";
    readonly reason: "keyUnreadable" | "notSet";
  }) => Effect.fail(new AudioUnavailable({ capability, reason })),
  MissingPermission: forbidden,
};
