import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import { ImageAspectSchema } from "./assistant.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { PlanLimitReached } from "./plan-limit-reached.ts";
import { maxPostTextLength } from "./post-text.ts";
import { VideoAllowanceReached } from "./video-allowance-reached.ts";
import { VideoBusy } from "./video-busy.ts";
import { VideoGenerationNotFound } from "./video-generation-not-found.ts";
import { VideoRequestRejected } from "./video-request-rejected.ts";
import { VideoUnavailable } from "./video-unavailable.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

/**
 * The longest description a video is made from, and how many videos a
 * workspace may ask for each UTC day. The server's values
 * (src/assistant/domain/video-limits.ts) are the source.
 */
export const maxVideoPromptLength = 1000;

export const videosPerDay = 20;

/** The longest length a request may name, in seconds: a provider takes fewer. */
export const maxVideoDurationSeconds = 60;

export const VideoGenerationRequestSchema = Schema.Struct({
  aspect: ImageAspectSchema,
  // How long the video lasts, in whole seconds, within what the chosen
  // provider takes (`durations` of its `video` offer in
  // `peal-contract/ai-providers`). Left out, the provider picks.
  durationSeconds: Schema.optionalKey(
    Schema.Int.check(
      Schema.isBetween({ maximum: maxVideoDurationSeconds, minimum: 1 })
    )
  ),
  // A ready image of the workspace's library to start the video from, for
  // a provider that takes one (`imageInput`).
  imageMediaId: Schema.optionalKey(Schema.String),
  // What the video should show, as plain text, sent to the provider as it
  // is. The assistant takes 1 to `maxVideoPromptLength` characters; this
  // bounds what the request can carry.
  prompt: Schema.String.check(Schema.isMaxLength(maxPostTextLength)),
}).annotate({ identifier: "VideoGenerationRequest" });

export type VideoGenerationRequest = typeof VideoGenerationRequestSchema.Type;

/**
 * Where a video stands: `queued`, waiting its turn; `running`, the provider
 * is making it; `succeeded`, it is a file of the media library
 * (`mediaId`); `failed`, nothing was kept (`reason`).
 */
export const VideoGenerationStatusSchema = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
]).annotate({ identifier: "VideoGenerationStatus" });

export type VideoGenerationStatus = typeof VideoGenerationStatusSchema.Type;

/**
 * Why a video failed:
 *
 * - `unavailable`: no provider is chosen for videos any more.
 * - `keyUnreadable`: the provider's key can no longer be read.
 * - `settingsRefused`: the provider refused the key, the account or the
 *   model (401, 402, 403, 404).
 * - `addressRefused`: the provider's address is not one Peal sends to.
 * - `redirected`: the provider answered with a redirect, never followed.
 * - `unreachable`: the provider could not be reached, or was busy (429,
 *   5xx).
 * - `refused`: the provider refused this request (its content rules, a
 *   setting the model does not take).
 * - `timedOut`: the video took longer than Peal waits.
 * - `unusableAnswer`: the provider's answer held no video the library
 *   takes, or one too large.
 * - `imageUnavailable`: the first frame was deleted, or could not be read.
 * - `storageFull`: the plan's media storage had no room for it.
 * - `notStored`: the media store failed to keep it.
 * - `interrupted`: the server stopped while it was made; it is never asked
 *   for again, as the provider may have made and billed it.
 *
 * New reasons join the end of the list.
 */
export const VideoFailureReasonSchema = Schema.Literals([
  "unavailable",
  "keyUnreadable",
  "settingsRefused",
  "addressRefused",
  "redirected",
  "unreachable",
  "refused",
  "timedOut",
  "unusableAnswer",
  "imageUnavailable",
  "storageFull",
  "notStored",
  "interrupted",
]).annotate({ identifier: "VideoFailureReason" });

export type VideoFailureReason = typeof VideoFailureReasonSchema.Type;

/** A video the workspace asked for, and where it stands. */
export const VideoGenerationSchema = Schema.Struct({
  aspect: ImageAspectSchema,
  createdAt: Schema.DateTimeUtc,
  // The length asked for, or null when the provider picks.
  durationSeconds: Schema.NullOr(Schema.Int),
  // When it ended, once `succeeded` or `failed`.
  finishedAt: Schema.NullOr(Schema.DateTimeUtc),
  id: Schema.String,
  // The image it started from, if any.
  imageMediaId: Schema.NullOr(Schema.String),
  // The video in the media library, once `succeeded`.
  mediaId: Schema.NullOr(Schema.String),
  // Why it failed, once `failed`.
  reason: Schema.NullOr(VideoFailureReasonSchema),
  // When the provider was asked, once `running`.
  startedAt: Schema.NullOr(Schema.DateTimeUtc),
  status: VideoGenerationStatusSchema,
}).annotate({ identifier: "VideoGeneration" });

export type VideoGeneration = typeof VideoGenerationSchema.Type;

/** The most videos a list answers. */
export const maxVideoGenerationsListed = 50;

export const VideoGenerationsSchema = Schema.Struct({
  generations: Schema.Array(VideoGenerationSchema),
}).annotate({ identifier: "VideoGenerations" });

export type VideoGenerations = typeof VideoGenerationsSchema.Type;

/**
 * Videos made for the workspace's media library by the provider it chose
 * for videos, with its own key: a durable job each, which a request starts
 * and the workspace follows.
 */
export class VideoGenerationsApi extends HttpApiGroup.make("media.videos")
  .add(
    HttpApiEndpoint.post("create", "/", {
      error: [
        Forbidden,
        VideoUnavailable,
        AssistantInputRejected,
        VideoRequestRejected,
        VideoBusy,
        VideoAllowanceReached,
        PlanLimitReached,
      ],
      headers: workspaceHeaders,

      payload: VideoGenerationRequestSchema,
      success: VideoGenerationSchema.pipe(HttpApiSchema.status(202)),
    }).annotateMerge(
      OpenApi.annotations({
        description: `Asks the provider the workspace chose for videos (\`PUT .../assistant/models/video\`) for one video from the prompt, in the aspect asked, optionally of a length and from a first frame, and answers 202 with the job, \`queued\`: making a video takes minutes. Follow it with \`GET .../media/videos/generations/{id}\`; once \`succeeded\`, the video is a file of the media library (\`mediaId\`), ready to attach, marked \`aiGenerated\`, and the member who asked is told in the app. Only the workspace's own provider makes videos, with its key, under its terms and at its prices: Peal bills nothing for them. One video at a time a workspace (VideoBusy), ${videosPerDay} a UTC day (VideoAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is made fails it (\`interrupted\`), as the provider may have made and billed it. Neither the prompt nor the video is logged, and the prompt is kept only while the video is made. Needs assistant:use and media:upload.`,
        summary: "Make a video into the media library",
      })
    ),
    HttpApiEndpoint.get("list", "/", {
      error: Forbidden,
      headers: workspaceHeaders,

      query: { status: Schema.optionalKey(VideoGenerationStatusSchema) },
      success: VideoGenerationsSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Lists the videos the workspace asked for, newest first, ${maxVideoGenerationsListed} at most, only those with \`status\` when given. Needs assistant:use.`,
        summary: "List video jobs",
      })
    ),
    HttpApiEndpoint.get("get", "/:generationId", {
      error: [Forbidden, VideoGenerationNotFound],
      headers: workspaceHeaders,
      params: { generationId: Schema.String },
      success: VideoGenerationSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Reads where a video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.",
        summary: "Get a video job",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/media/videos/generations") {}
