import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import {
  imageProviderModelPattern,
  maxImageProviderModelLength,
} from "./assistant.ts";
import { AudioAllowanceReached } from "./audio-allowance-reached.ts";
import { AudioProviderFailed } from "./audio-provider-failed.ts";
import { AudioUnavailable } from "./audio-unavailable.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { MediaStoreUnavailable } from "./media-store-unavailable.ts";
import { MediaSchema } from "./media.ts";
import { PlanLimitReached } from "./plan-limit-reached.ts";
import { VoiceNotOffered } from "./voice-not-offered.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

/**
 * The longest text a voice-over is made from, in UTF-16 code units, and
 * how many voice-overs and transcripts a workspace may ask for each UTC
 * day. The server's values (src/assistant/domain/audio-limits.ts) are the
 * source; a test keeps them equal.
 */
export const maxVoiceoverTextLength = 4000;

export const voiceoversPerDay = 50;

export const transcriptionsPerDay = 50;

/** The largest audio or video file a transcript is made of, in bytes. */
export const maxTranscriptionBytes = 25_000_000;

export const VoiceoverRequestSchema = Schema.Struct({
  // What is said, as plain text, sent to the provider as it is. The
  // assistant takes 1 to `maxVoiceoverTextLength` characters; this bounds
  // what the request can carry.
  text: Schema.String.check(Schema.isMaxLength(maxVoiceoverTextLength * 2)),
  // The voice that speaks, as the provider names it (one of `voices` in
  // its `speech` offer of `peal-contract/ai-providers`, or another it
  // knows). Left out, the provider's default.
  voice: Schema.optionalKey(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maxImageProviderModelLength),
      Schema.isPattern(imageProviderModelPattern, {
        expected: "a voice's name on one line, without control characters",
      })
    )
  ),
}).annotate({ identifier: "VoiceoverRequest" });

export type VoiceoverRequest = typeof VoiceoverRequestSchema.Type;

export const TranscriptionRequestSchema = Schema.Struct({
  // Whether to save the transcript as the file's description, when it
  // fits one (`descriptionSaved` says whether it did).
  saveAsDescription: Schema.optionalKey(Schema.Boolean),
}).annotate({ identifier: "TranscriptionRequest" });

export type TranscriptionRequest = typeof TranscriptionRequestSchema.Type;

/** What was said in a file of the library, as the provider wrote it. */
export const TranscriptSchema = Schema.Struct({
  // Whether the transcript is now the file's description: asked for, and
  // short enough for one.
  descriptionSaved: Schema.Boolean,
  // How long the audio lasts, in seconds, when the provider says.
  durationSeconds: Schema.NullOr(Schema.Number),
  // The language spoken, as the provider names it, when it says.
  language: Schema.NullOr(Schema.String),
  text: Schema.String,
}).annotate({ identifier: "Transcript" });

export type Transcript = typeof TranscriptSchema.Type;

/**
 * Voice-overs for the workspace's media library, made from a text by the
 * provider it chose, with its own key. Peal only sends the request, waits,
 * and keeps the result. Transcripts are `MediaTranscriptionsApi`'s.
 */
export class MediaAudioApi extends HttpApiGroup.make("media.voiceovers")
  .add(
    HttpApiEndpoint.post("create", "/", {
      error: [
        Forbidden,
        AudioUnavailable,
        AssistantInputRejected,
        VoiceNotOffered,
        AudioAllowanceReached,
        AudioProviderFailed,
        PlanLimitReached,
        MediaStoreUnavailable,
      ],
      headers: workspaceHeaders,

      payload: VoiceoverRequestSchema,
      success: MediaSchema.pipe(HttpApiSchema.status(201)),
    }).annotateMerge(
      OpenApi.annotations({
        description: `Asks the provider the workspace chose for voice-overs (\`PUT .../assistant/models/speech\`) to speak the text, in \`voice\` when given, and answers with the audio as a new file of the media library, marked \`aiGenerated\`, without a description. Only the workspace's own provider speaks, with its key, under its terms and at its prices: Peal bills nothing for it. ${voiceoversPerDay} a UTC day (AudioAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest voice-over before anything is asked. Neither the text nor the audio is logged. Needs assistant:use and media:upload.`,
        summary: "Make a voice-over into the media library",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/media/voiceovers") {}
