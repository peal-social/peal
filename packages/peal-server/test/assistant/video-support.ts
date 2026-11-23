import { Context, Effect, Layer, Option, Ref } from "effect";
import { MessageStorage, ShardingConfig } from "effect/cluster";
import { SqlClient } from "effect/sql";

import { AssistantVideos } from "#assistant/application/assistant-videos.ts";
import { GeneratedVideos } from "#assistant/application/ports/generated-videos.ts";
import type { FirstFrame } from "#assistant/application/ports/own-video-model.ts";
import { VideoJobs } from "#assistant/application/ports/video-jobs.ts";
import { VideoNotices } from "#assistant/application/ports/video-notices.ts";
import { VideoFailed } from "#assistant/application/video-failed.ts";
import type {
  VideoGeneration,
  VideoGenerationId,
} from "#assistant/domain/video-generation.ts";
import { DrizzleVideoGenerationsLive } from "#assistant/infrastructure/drizzle-video-generations.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";
import { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";

/** What the video use cases did around their store: jobs started, notices. */
export class VideoRecords extends Context.Service<
  VideoRecords,
  {
    readonly started: Ref.Ref<readonly VideoGenerationId[]>;
    readonly told: Ref.Ref<readonly VideoGeneration[]>;
    /** Bytes kept in the library, by the id they were kept as. */
    readonly stored: Ref.Ref<readonly Uint8Array[]>;
  }
>()("test/assistant/VideoRecords") {
  static readonly layer = Layer.effect(
    VideoRecords,
    Effect.gen(function* VideoRecordsLive() {
      return VideoRecords.of({
        started: yield* Ref.make<readonly VideoGenerationId[]>([]),
        stored: yield* Ref.make<readonly Uint8Array[]>([]),
        told: yield* Ref.make<readonly VideoGeneration[]>([]),
      });
    })
  );
}

/** The library as a test scripts it. */
export interface LibraryScript {
  /** Whether a first frame can be read when the job runs. */
  readonly firstFrames?: boolean;
  /** The ready images of any workspace, by id. */
  readonly images?: ReadonlyMap<string, FirstFrame>;
  /** Whether the plan has room for the largest video. */
  readonly room?: boolean;
  /** How storing a video ends: kept, or failed for this reason. */
  readonly store?: "kept" | VideoFailed["reason"];
}

/** The id a test's stored video is kept as. */
export const storedVideoId = MediaAssetIdSchema.make(
  "019a0000-0000-7000-8000-00000000a1d0"
);

const fullPlan = () =>
  new PlanLimitReached({
    allowed: 1000,
    limit: "mediaStorage",
    needed: 2000,
    used: 1000,
  });

/** GeneratedVideos as the script says, recording what it keeps. */
export const scriptedLibrary = ({
  firstFrames = true,
  images = new Map(),
  room = true,
  store = "kept",
}: LibraryScript = {}) =>
  Layer.effect(
    GeneratedVideos,
    Effect.gen(function* ScriptedLibrary() {
      const records = yield* VideoRecords;

      return GeneratedVideos.of({
        firstFrame: (_, assetId: MediaAssetId) =>
          Effect.succeed(
            firstFrames
              ? Option.fromUndefinedOr(images.get(assetId))
              : Option.none()
          ),
        isImage: (_, assetId) => Effect.succeed(images.has(assetId)),
        roomFor: () => (room ? Effect.void : Effect.fail(fullPlan())),
        store: (_, bytes) =>
          store === "kept"
            ? Ref.update(records.stored, (all) => [...all, bytes]).pipe(
                Effect.as(storedVideoId)
              )
            : Effect.fail(new VideoFailed({ reason: store })),
      });
    })
  );

/** Jobs and notices recorded, never run nor sent. */
export const RecordedVideoJobs = Layer.mergeAll(
  Layer.effect(
    VideoJobs,
    VideoRecords.use((records) =>
      Effect.succeed(
        VideoJobs.of({
          start: (id) => Ref.update(records.started, (all) => [...all, id]),
        })
      )
    )
  ),
  Layer.effect(
    VideoNotices,
    VideoRecords.use((records) =>
      Effect.succeed(
        VideoNotices.of({
          ended: (generation) =>
            Ref.update(records.told, (all) => [...all, generation]),
        })
      )
    )
  )
);

/**
 * A TransactionRunner on the test's database, its workflow starts kept in
 * memory.
 */
export const TransactionsTest = TransactionRunnerLive.pipe(
  Layer.provide(
    MessageStorage.layerMemory.pipe(Layer.provide(ShardingConfig.layer()))
  )
);

/**
 * The video ports of a test: the real store on Postgres, the library as
 * scripted, the jobs and notices recorded. Needs DatabaseTest.
 */
export const videoPortsTest = (library: LibraryScript = {}) =>
  Layer.mergeAll(
    DrizzleVideoGenerationsLive,
    TransactionsTest,
    RecordedVideoJobs,
    scriptedLibrary(library)
  ).pipe(Layer.provideMerge(VideoRecords.layer));

/**
 * AssistantVideos on `videoPortsTest`, for the assistant's endpoints. Needs
 * DatabaseTest and the providers' stores (CapabilityModels,
 * ProviderConnections).
 */
export const assistantVideosTest = (library: LibraryScript = {}) =>
  AssistantVideos.layer.pipe(Layer.provideMerge(videoPortsTest(library)));

/** Deletes a workspace's video jobs when the test ends. */
export const forgetVideosOf = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap((sql) =>
      Effect.addFinalizer(() =>
        sql`DELETE FROM assistant.video_generations WHERE workspace_id = ${workspaceId}`.pipe(
          Effect.ignore
        )
      )
    )
  );
