import { Context, Duration, Effect, Layer, Option, Ref } from "effect";
import { SqlClient } from "effect/sql";

import { AssistantSlideshows } from "#assistant/application/assistant-slideshows.ts";
import { SlideshowJobs } from "#assistant/application/ports/slideshow-jobs.ts";
import { SlideshowMedia } from "#assistant/application/ports/slideshow-media.ts";
import type { SlideshowSource } from "#assistant/application/ports/slideshow-media.ts";
import { SlideshowNotices } from "#assistant/application/ports/slideshow-notices.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import type { Slideshow, SlideshowId } from "#assistant/domain/slideshow.ts";
import { DrizzleSlideshowsLive } from "#assistant/infrastructure/drizzle-slideshows.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";
import { TransactionsTest } from "#test/assistant/video-support.ts";

/** What the slide video use cases did around their store. */
export class SlideshowRecords extends Context.Service<
  SlideshowRecords,
  {
    readonly started: Ref.Ref<readonly SlideshowId[]>;
    readonly told: Ref.Ref<readonly Slideshow[]>;
    readonly stored: Ref.Ref<readonly Uint8Array[]>;
    /** Every link handed out, with how long it works, in seconds. */
    readonly linked: Ref.Ref<readonly (readonly [string, number])[]>;
  }
>()("test/assistant/SlideshowRecords") {
  static readonly layer = Layer.effect(
    SlideshowRecords,
    Effect.gen(function* SlideshowRecordsLive() {
      return SlideshowRecords.of({
        linked: yield* Ref.make<readonly (readonly [string, number])[]>([]),
        started: yield* Ref.make<readonly SlideshowId[]>([]),
        stored: yield* Ref.make<readonly Uint8Array[]>([]),
        told: yield* Ref.make<readonly Slideshow[]>([]),
      });
    })
  );
}

/** The library as a test scripts it. */
export interface SlideshowLibraryScript {
  /** The ready files of any workspace, by id. */
  readonly files?: ReadonlyMap<string, SlideshowSource>;
  /** Whether links can be signed when the job runs. */
  readonly links?: boolean;
  /** Whether the plan has room for the largest video. */
  readonly room?: boolean;
  /** How storing a video ends: kept, or failed for this reason. */
  readonly store?: "kept" | SlideshowFailed["reason"];
}

/** The id a test's stored slide video is kept as. */
export const storedSlideshowId = MediaAssetIdSchema.make(
  "019a0000-0000-7000-8000-00000000b1d0"
);

/** A ready image of the library, of a media type. */
export const imageFile = (contentType = "image/png"): SlideshowSource => ({
  contentType,
  durationSeconds: Option.none(),
  kind: "image",
});

/** A ready audio file of the library, of a length. */
export const audioFile = (seconds: number): SlideshowSource => ({
  contentType: "audio/mpeg",
  durationSeconds: Option.some(seconds),
  kind: "audio",
});

const fullPlan = () =>
  new PlanLimitReached({
    allowed: 1000,
    limit: "mediaStorage",
    needed: 2000,
    used: 1000,
  });

/** SlideshowMedia as the script says, recording what it hands out. */
export const scriptedSlideshowMedia = ({
  files = new Map(),
  links = true,
  room = true,
  store = "kept",
}: SlideshowLibraryScript = {}) =>
  Layer.effect(
    SlideshowMedia,
    Effect.gen(function* ScriptedSlideshowMedia() {
      const records = yield* SlideshowRecords;

      return SlideshowMedia.of({
        describe: (_, assetId) =>
          Effect.succeed(Option.fromUndefinedOr(files.get(assetId))),
        linkTo: (_, assetId, expiresIn) => {
          const url = `https://media.example.com/signed/${assetId}`;

          return links && files.has(assetId)
            ? Ref.update(records.linked, (all) => [
                ...all,
                [url, Duration.toSeconds(expiresIn)] as const,
              ]).pipe(Effect.as(Option.some(url)))
            : Effect.succeed(Option.none());
        },
        roomFor: () => (room ? Effect.void : Effect.fail(fullPlan())),
        store: (_, bytes) =>
          store === "kept"
            ? Ref.update(records.stored, (all) => [...all, bytes]).pipe(
                Effect.as(storedSlideshowId)
              )
            : Effect.fail(new SlideshowFailed({ reason: store })),
      });
    })
  );

/** Jobs and notices recorded, never run nor sent. */
export const RecordedSlideshowJobs = Layer.mergeAll(
  Layer.effect(
    SlideshowJobs,
    SlideshowRecords.use((records) =>
      Effect.succeed(
        SlideshowJobs.of({
          start: (id) => Ref.update(records.started, (all) => [...all, id]),
        })
      )
    )
  ),
  Layer.effect(
    SlideshowNotices,
    SlideshowRecords.use((records) =>
      Effect.succeed(
        SlideshowNotices.of({
          ended: (slideshow) =>
            Ref.update(records.told, (all) => [...all, slideshow]),
        })
      )
    )
  )
);

/**
 * The slide video ports of a test: the real store on Postgres, the library
 * as scripted, the jobs and notices recorded. Needs DatabaseTest.
 */
export const slideshowPortsTest = (library: SlideshowLibraryScript = {}) =>
  Layer.mergeAll(
    DrizzleSlideshowsLive,
    TransactionsTest,
    RecordedSlideshowJobs,
    scriptedSlideshowMedia(library)
  ).pipe(Layer.provideMerge(SlideshowRecords.layer));

/**
 * AssistantSlideshows on `slideshowPortsTest`. Needs DatabaseTest, the
 * meters and the providers' stores (CapabilityModels, ProviderConnections).
 */
export const assistantSlideshowsTest = (library: SlideshowLibraryScript = {}) =>
  AssistantSlideshows.layer.pipe(
    Layer.provideMerge(slideshowPortsTest(library))
  );

/** Deletes a workspace's slide video jobs when the test ends. */
export const forgetSlideshowsOf = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap((sql) =>
      Effect.addFinalizer(() =>
        sql`DELETE FROM assistant.slideshows WHERE workspace_id = ${workspaceId}`.pipe(
          Effect.ignore
        )
      )
    )
  );
