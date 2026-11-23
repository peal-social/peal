import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why the provider chosen for voice-overs or transcripts gave none:
 *
 * - `settingsRefused`: it refused the key, the account or the model (401,
 *   402, 403, 404).
 * - `addressRefused`: its address is not one Peal sends to.
 * - `redirected`: it answered with a redirect, never followed.
 * - `unreachable`: it could not be reached, or was busy (429, 5xx).
 * - `refused`: it refused this request (its content rules, a setting the
 *   model does not take, a voice it does not know).
 * - `timedOut`: it took longer than Peal waits.
 * - `unusableAnswer`: it answered, but with no audio or text Peal can
 *   use, or with a file the media library does not take.
 */
export const AudioFailureReasonSchema = Schema.Literals([
  "settingsRefused",
  "addressRefused",
  "redirected",
  "unreachable",
  "refused",
  "timedOut",
  "unusableAnswer",
]).annotate({ identifier: "AudioFailureReason" });

export type AudioFailureReason = typeof AudioFailureReasonSchema.Type;

/** The workspace's provider gave no voice-over or no transcript. */
export class AudioProviderFailed extends Schema.TaggedError<AudioProviderFailed>()(
  "AudioProviderFailed",
  {
    ...errorEnvelope,
    capability: Schema.Literals(["speech", "transcription"]),
    reason: AudioFailureReasonSchema,
  },
  {
    description:
      "The provider the workspace chose for voice-overs (`capability` `speech`) or transcripts (`transcription`) gave none, for `reason`. The request still counts toward the day's allowance, as the provider may have billed it. Nothing was kept.",
    httpApiStatus: 502,
  }
) {}
