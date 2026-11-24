import { Context } from "effect";
import type { Duration, Effect, Option } from "effect";

import type { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/** A ready file of the library, as a slide video takes it. */
export interface SlideshowSource {
  /** Whether it was made by AI. */
  readonly aiGenerated: boolean;
  /** `image`, `video`, `audio` or `document`. */
  readonly kind: string;
  /** Its media type, such as `image/png`. */
  readonly contentType: string;
  /** Its length in seconds, when the probe read one. */
  readonly durationSeconds: Option.Option<number>;
}

/**
 * The workspace's media library, for slide videos: what a file is, a
 * short-lived link the service fetches it from, the room for the video and
 * where it is kept. A job acts for the workspace once a member asked (the
 * request checked their permissions).
 */
export class SlideshowMedia extends Context.Service<
  SlideshowMedia,
  {
    /** Fails when the plan's storage has no room for the largest video. */
    readonly roomFor: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, PlanLimitReached>;
    /** A ready file of the workspace; none when it is not one. */
    readonly describe: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId
    ) => Effect.Effect<Option.Option<SlideshowSource>>;
    /**
     * A presigned GET of a ready file of the workspace that stops working
     * after `expiresIn`, whether or not the store serves the bucket
     * publicly; none when it is gone or the store cannot sign one.
     */
    readonly linkTo: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId,
      expiresIn: Duration.Duration
    ) => Effect.Effect<Option.Option<string>>;
    /**
     * Keeps the bytes as they came, marked as made by AI or not:
     * `storageFull` when the plan has no room, `unusableAnswer` for bytes
     * that are no video the library takes, `notStored` when the store
     * fails.
     */
    readonly store: (
      workspaceId: WorkspaceId,
      bytes: Uint8Array,
      options: { readonly aiGenerated: boolean }
    ) => Effect.Effect<MediaAssetId, SlideshowFailed>;
  }
>()("peal-server/assistant/application/SlideshowMedia") {}
