import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { AudioAllowanceReached } from "./audio-allowance-reached.ts";
import { AudioProviderFailed } from "./audio-provider-failed.ts";
import { AudioUnavailable } from "./audio-unavailable.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import {
  maxTranscriptionBytes,
  TranscriptionRequestSchema,
  transcriptionsPerDay,
  TranscriptSchema,
} from "./media-audio.ts";
import { MediaNotFound } from "./media-not-found.ts";
import { MediaStoreUnavailable } from "./media-store-unavailable.ts";
import { TranscriptionRejected } from "./transcription-rejected.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

/**
 * Transcripts of the audio and videos of the workspace's media library,
 * from the provider it chose, with its own key.
 */
export class MediaTranscriptionsApi extends HttpApiGroup.make(
  "media.transcriptions"
)
  .add(
    HttpApiEndpoint.post("create", "/:mediaId/transcriptions", {
      error: [
        Forbidden,
        MediaNotFound,
        TranscriptionRejected,
        AudioUnavailable,
        AudioAllowanceReached,
        AudioProviderFailed,
        MediaStoreUnavailable,
      ],
      headers: workspaceHeaders,
      params: { mediaId: Schema.String },
      payload: TranscriptionRequestSchema,
      success: TranscriptSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Sends a ready audio or video file of the media library, of at most ${maxTranscriptionBytes} bytes, to the provider the workspace chose for transcripts (\`PUT .../assistant/models/transcription\`), and answers with what is said in it. With \`saveAsDescription\`, the transcript becomes the file's description when it fits one (\`descriptionSaved\`). Only the workspace's own provider transcribes, with its key, under its terms and at its prices: Peal bills nothing for it. ${transcriptionsPerDay} a UTC day (AudioAllowanceReached), whatever each ends with. Neither the file nor the transcript is logged, and the transcript is kept only as the description asked for. Needs assistant:use and media:read, and media:upload to save the description.`,
        summary: "Transcribe a file of the media library",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/media") {}
