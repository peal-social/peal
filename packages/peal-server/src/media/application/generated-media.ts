import { Context, Duration, Effect, Layer, Option } from "effect";

import type { GeneratedVideoUnusable } from "#media/application/generated-video-unusable.ts";
import type { MediaStorageFailed } from "#media/application/media-storage-failed.ts";
import type { ImportSlots } from "#media/application/ports/import-slots.ts";
import { MediaAssets } from "#media/application/ports/media-assets.ts";
import type { MediaProbe } from "#media/application/ports/media-probe.ts";
import { MediaStorage } from "#media/application/ports/media-storage.ts";
import type { MediaUsage } from "#media/application/ports/media-usage.ts";
import type { RemoteMedia } from "#media/application/ports/remote-media.ts";
import type { StorageAllowance } from "#media/application/ports/storage-allowance.ts";
import {
  roomForVideo,
  storeGeneratedVideo,
} from "#media/application/use-cases/store-generated-video.ts";
import type { MediaItem } from "#media/application/use-cases/view-media.ts";
import type { Ids } from "#shared/application/ids.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/** A ready file of the workspace, as a composition takes it. */
export interface SourceFile {
  /** Whether it was made by AI. */
  readonly aiGenerated: boolean;
  readonly contentType: string;
  /** Its length in seconds, when the probe read one. */
  readonly durationSeconds: Option.Option<number>;
  readonly kind: string;
}

type MediaPorts =
  | Ids
  | ImportSlots
  | MediaAssets
  | MediaProbe
  | MediaStorage
  | MediaUsage
  | RemoteMedia
  | StorageAllowance;

/**
 * The files the assistant's durable jobs make, for a workspace: a video,
 * asked for by a member whose permissions the request checked (assistant:use
 * and media:upload), made minutes later by a job that acts for the
 * workspace, as publishing's jobs do through MediaForPlatforms. No
 * permission is checked here.
 */
export class GeneratedMedia extends Context.Service<
  GeneratedMedia,
  {
    /** Whether the workspace's storage has room for `largest` bytes. */
    readonly roomForVideo: (
      workspaceId: WorkspaceId,
      largest: number
    ) => Effect.Effect<void, PlanLimitReached>;
    /**
     * Stores a video, marked as made by AI unless `aiGenerated` is false
     * (a slide video composed of files none of which was), and probes it.
     */
    readonly storeVideo: (
      workspaceId: WorkspaceId,
      bytes: Uint8Array,
      options?: { readonly aiGenerated?: boolean }
    ) => Effect.Effect<
      MediaItem,
      GeneratedVideoUnusable | MediaStorageFailed | PlanLimitReached
    >;
    /** A ready file of the workspace; none when it is not one. */
    readonly describeSource: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId
    ) => Effect.Effect<Option.Option<SourceFile>>;
    /**
     * A presigned GET of a ready file of the workspace that stops working
     * after `expiresIn`, whether or not the store serves the bucket
     * publicly, for a service the workspace sends it to; none when it is
     * not a ready file of the workspace.
     */
    readonly sourceLink: (
      workspaceId: WorkspaceId,
      assetId: MediaAssetId,
      expiresIn: Duration.Duration
    ) => Effect.Effect<Option.Option<string>, MediaStorageFailed>;
  }
>()("peal-server/media/application/GeneratedMedia") {
  static readonly layer = Layer.effect(
    GeneratedMedia,
    Effect.gen(function* GeneratedMediaLive() {
      const ports = yield* Effect.context<MediaPorts>();
      const assets = yield* MediaAssets;
      const storage = yield* MediaStorage;

      // A ready asset of the workspace, or none.
      const ready = (workspaceId: WorkspaceId, assetId: MediaAssetId) =>
        assets
          .findById(workspaceId, assetId)
          .pipe(
            Effect.map(Option.filter((asset) => asset.status._tag === "ready"))
          );

      return GeneratedMedia.of({
        describeSource: (workspaceId, assetId) =>
          ready(workspaceId, assetId).pipe(
            Effect.map(
              Option.map((asset): SourceFile => ({
                aiGenerated: asset.aiGenerated,
                contentType: asset.contentType,
                durationSeconds: asset.metadata.duration.pipe(
                  Option.map(Duration.toSeconds)
                ),
                kind: asset.kind,
              }))
            )
          ),
        sourceLink: (workspaceId, assetId, expiresIn) =>
          ready(workspaceId, assetId).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeedNone,
                onSome: (asset) =>
                  storage
                    .downloadUrl(asset.storageKey, expiresIn)
                    .pipe(Effect.map(Option.some)),
              })
            )
          ),
        roomForVideo: (workspaceId, largest) =>
          roomForVideo(workspaceId, largest).pipe(Effect.provideContext(ports)),
        storeVideo: (workspaceId, bytes, options) =>
          storeGeneratedVideo(workspaceId, bytes, options).pipe(
            // The asset was recorded a moment ago, by this very call.
            Effect.catchTags({
              InvalidMediaTransition: Effect.die,
              MediaAssetNotFound: Effect.die,
              MediaInUse: Effect.die,
              UploadIncomplete: Effect.die,
            }),
            Effect.provideContext(ports)
          ),
      });
    })
  );
}
