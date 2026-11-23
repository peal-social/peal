import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { FirstFrame } from "#assistant/application/ports/own-video-model.ts";
import type { VideoFailed } from "#assistant/application/video-failed.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/**
 * Where the videos the assistant makes are kept, and where their first
 * frames come from: the media library of the workspace, for a job that
 * acts for it once a member asked (the request checked their
 * permissions).
 */
export class GeneratedVideos extends Context.Service<
  GeneratedVideos,
  {
    /** Fails when the plan's storage has no room for the largest video. */
    readonly roomFor: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, PlanLimitReached>;
    /** Whether the asset is a ready image of the workspace. */
    readonly isImage: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId
    ) => Effect.Effect<boolean>;
    /** The image's bytes; none when it is gone or cannot be read. */
    readonly firstFrame: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId
    ) => Effect.Effect<Option.Option<FirstFrame>>;
    /**
     * Keeps the bytes as they came, marked as made by AI: `storageFull`
     * when the plan has no room, `unusableAnswer` for bytes that are no
     * video the library takes, `notStored` when the store fails.
     */
    readonly store: (
      workspaceId: WorkspaceId,
      bytes: Uint8Array
    ) => Effect.Effect<MediaAssetId, VideoFailed>;
  }
>()("peal-server/assistant/application/GeneratedVideos") {}
