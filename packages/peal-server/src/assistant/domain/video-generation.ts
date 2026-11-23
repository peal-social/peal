import { Result, Schema } from "effect";

import {
  MediaAssetIdSchema,
  UserIdSchema,
  Uuid7Schema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";

import { DraftRejected } from "./draft-rejected.ts";
import { ImageAspectSchema } from "./image-aspect.ts";
import { maxVideoPromptLength } from "./video-limits.ts";

/** A video a workspace asked for: a lowercase UUIDv7. */
export const VideoGenerationIdSchema = Uuid7Schema.pipe(
  Schema.brand("VideoGenerationId")
);

export type VideoGenerationId = typeof VideoGenerationIdSchema.Type;

/**
 * Where a video stands: waiting its turn, being made, a file of the
 * library, or failed. Stored as text: add states, never rename one.
 */
export const VideoStatusSchema = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export type VideoStatus = typeof VideoStatusSchema.Type;

/**
 * Why a video failed (the contract's `VideoFailureReason`, kept equal by
 * `test/assistant/api/contract.test.ts`). Stored as text: add reasons,
 * never rename one.
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
]);

export type VideoFailureReason = typeof VideoFailureReasonSchema.Type;

/**
 * A video a workspace asked for, without its prompt, which is kept apart
 * only while the video is made.
 */
export class VideoGeneration extends Schema.Class<VideoGeneration>(
  "peal-server/assistant/domain/VideoGeneration"
)({
  aspect: ImageAspectSchema,
  createdAt: Schema.DateTimeUtc,
  durationSeconds: Schema.Option(Schema.Int),
  finishedAt: Schema.Option(Schema.DateTimeUtc),
  id: VideoGenerationIdSchema,
  imageMediaId: Schema.Option(MediaAssetIdSchema),
  mediaId: Schema.Option(MediaAssetIdSchema),
  reason: Schema.Option(VideoFailureReasonSchema),
  /** The member who asked, when a member did (not a key). */
  requestedBy: Schema.Option(UserIdSchema),
  startedAt: Schema.Option(Schema.DateTimeUtc),
  status: VideoStatusSchema,
  workspaceId: WorkspaceIdSchema,
}) {}

/**
 * What the video should show, as the person described it: not blank, and
 * at most `maxVideoPromptLength` long. It is sent to the provider as it is.
 */
export const VideoPromptSchema = Schema.String.check(
  Schema.isMaxLength(maxVideoPromptLength),
  Schema.makeFilter((text: string) => text.trim() !== "", {
    expected: "a text that is not blank",
  })
).pipe(Schema.brand("VideoPrompt"));

export type VideoPrompt = typeof VideoPromptSchema.Type;

/** The description as a video prompt, or why the assistant cannot take it. */
export const checkVideoPrompt = (
  text: string
): Result.Result<VideoPrompt, DraftRejected> => {
  if (text.trim() === "") {
    return Result.fail(
      new DraftRejected({ maxLength: maxVideoPromptLength, reason: "empty" })
    );
  }

  return text.length > maxVideoPromptLength
    ? Result.fail(
        new DraftRejected({
          maxLength: maxVideoPromptLength,
          reason: "tooLong",
        })
      )
    : Result.succeed(VideoPromptSchema.make(text));
};
