import { Result, Schema } from "effect";

import { maxVoiceoverTextLength } from "./audio-limits.ts";
import { DraftRejected } from "./draft-rejected.ts";

/** The two uses that make or read audio. */
export const AudioCapabilitySchema = Schema.Literals([
  "speech",
  "transcription",
]);

export type AudioCapability = typeof AudioCapabilitySchema.Type;

/**
 * Why a provider gave no voice-over or no transcript (the contract's
 * `AudioFailureReason`).
 */
export const AudioFailureReasonSchema = Schema.Literals([
  "settingsRefused",
  "addressRefused",
  "redirected",
  "unreachable",
  "refused",
  "timedOut",
  "unusableAnswer",
]);

export type AudioFailureReason = typeof AudioFailureReasonSchema.Type;

/** What a voice-over says, once checked: 1 to `maxVoiceoverTextLength`. */
export const VoiceoverTextSchema = Schema.String.pipe(
  Schema.brand("VoiceoverText")
);

export type VoiceoverText = typeof VoiceoverTextSchema.Type;

/** A voice-over's text, refused when blank or too long. */
export const checkVoiceoverText = (
  text: string
): Result.Result<VoiceoverText, DraftRejected> => {
  if (text.trim() === "") {
    return Result.fail(
      new DraftRejected({ maxLength: maxVoiceoverTextLength, reason: "empty" })
    );
  }

  return text.length > maxVoiceoverTextLength
    ? Result.fail(
        new DraftRejected({
          maxLength: maxVoiceoverTextLength,
          reason: "tooLong",
        })
      )
    : Result.succeed(VoiceoverTextSchema.make(text));
};
