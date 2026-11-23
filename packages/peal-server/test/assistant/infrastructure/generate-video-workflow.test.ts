import { assert, layer } from "@effect/vitest";
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Redacted,
  Ref,
  Scope,
} from "effect";
import { MessageStorage } from "effect/cluster";

import { AssistantVideos } from "#assistant/application/assistant-videos.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { OwnVideoModel } from "#assistant/application/ports/own-video-model.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { VideoGenerationStore } from "#assistant/application/ports/video-generation-store.ts";
import { VideoNotices } from "#assistant/application/ports/video-notices.ts";
import { VideoSlots } from "#assistant/application/ports/video-slots.ts";
import { RunVideoGeneration } from "#assistant/application/run-video-generation.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import type { VideoGenerationId } from "#assistant/domain/video-generation.ts";
import { DrizzleVideoGenerationsLive } from "#assistant/infrastructure/drizzle-video-generations.ts";
import {
  GenerateResultSchema,
  GenerateVideoV1,
  GenerateVideoV1Live,
  WorkflowVideoJobs,
} from "#assistant/infrastructure/workflows/generate-video.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import {
  actorIn,
  DatabaseTest,
  freshWorkspace,
  ImageProvidersTest,
} from "#test/assistant/support.ts";
import {
  scriptedLibrary,
  VideoRecords,
} from "#test/assistant/video-support.ts";
import {
  clusterOver,
  eventually,
  shutDown,
} from "#test/publishing/infrastructure/harness.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// GenerateVideoV1 on the in-memory cluster the publishing workflows are
// tested on, its job's row in Postgres: a video made once, and a restart
// while the provider makes it, which fails the job instead of asking again.

const timeout = 60_000;

/** What the provider was asked, and how it answers: outlives a server. */
class Provider extends Context.Service<
  Provider,
  {
    readonly calls: Ref.Ref<number>;
    readonly answer: Ref.Ref<Effect.Effect<Uint8Array>>;
  }
>()("test/assistant/VideoProvider") {}

const videoBytes = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

const ScriptedModel = Layer.effect(
  OwnVideoModel,
  Provider.use(({ answer, calls }) =>
    Effect.succeed(
      OwnVideoModel.of({
        generate: () =>
          Ref.update(calls, (count) => count + 1).pipe(
            Effect.andThen(Ref.get(answer)),
            Effect.flatten
          ),
      })
    )
  )
);

const QuietNotices = Layer.succeed(
  VideoNotices,
  VideoNotices.of({ ended: () => Effect.void })
);

/** One server, on a fresh Sharding over `storage`. */
const serverOver = <S, E, R>(storage: Layer.Layer<S, E, R>) =>
  GenerateVideoV1Live.pipe(
    Layer.provideMerge(
      Layer.mergeAll(AssistantVideos.layer, RunVideoGeneration.layer)
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        DrizzleVideoGenerationsLive,
        TransactionRunnerLive,
        WorkflowVideoJobs,
        QuietNotices,
        scriptedLibrary(),
        ScriptedModel,
        VideoSlots.layer
      ).pipe(Layer.provideMerge(VideoRecords.layer))
    ),
    Layer.provideMerge(ImageProvidersTest),
    Layer.provideMerge(clusterOver(storage))
  );

const choosing = (workspaceId: WorkspaceId) =>
  Effect.gen(function* choose() {
    const now = yield* DateTime.now;

    yield* ProviderConnections.use((connections) =>
      connections.save(
        workspaceId,
        new ProviderConnectionSettings({
          baseUrl: ProviderAddressSchema.make("https://api.x.ai/v1"),
          provider: "xai",
          updatedAt: now,
        }),
        Redacted.make("sk_test_synthetic_video_key")
      )
    ).pipe(Effect.orDie);
    yield* CapabilityModels.use((models) =>
      models.set(
        workspaceId,
        new CapabilityModelSettings({
          capability: "video",
          model: ProviderModelSchema.make("grok-imagine-video"),
          provider: "xai",
          updatedAt: now,
        })
      )
    );
  });

const asking = (workspaceId: WorkspaceId) =>
  AssistantVideos.use((videos) =>
    videos.request(actorIn(workspaceId, permissionsFor("editor")), {
      aspect: "landscape",
      durationSeconds: 6,
      imageMediaId: null,
      prompt: "A synthetic harbour at dawn.",
    })
  ).pipe(Effect.orDie);

const statusOf = (id: VideoGenerationId) =>
  VideoGenerationStore.use((store) => store.find(id)).pipe(
    Effect.map(Option.map(({ reason, status }) => ({ reason, status })))
  );

const jobEnded = (id: VideoGenerationId) =>
  Effect.gen(function* pollingJob() {
    const executionId = yield* GenerateVideoV1.executionId({
      generationId: id,
    });

    const result = yield* GenerateVideoV1.poll(executionId);

    return Option.isSome(result) && result.value._tag === "Complete";
  });

const providerWith = (answer: Effect.Effect<Uint8Array>) =>
  Effect.gen(function* provider() {
    return Provider.of({
      answer: yield* Ref.make(answer),
      calls: yield* Ref.make(0),
    });
  });

layer(DatabaseTest, { timeout: "120 seconds" })("GenerateVideoV1", (it) => {
  it.effect("keeps its tag and how a run leaves its job", () =>
    Effect.sync(() => {
      assert.strictEqual(GenerateVideoV1._tag, "GenerateVideoV1");
      assert.deepStrictEqual(GenerateResultSchema.literals, [
        "succeeded",
        "failed",
        "superseded",
      ]);
    })
  );

  it.effect(
    "makes a video once, and starting its job again does nothing more",
    () =>
      Effect.gen(function* once() {
        const provider = yield* providerWith(Effect.succeed(videoBytes));

        const server = serverOver(MessageStorage.layerMemory).pipe(
          Layer.provide(Layer.succeed(Provider, provider))
        );

        const scope = yield* Scope.make();
        const built = yield* Layer.buildWithScope(server, scope);

        yield* Effect.gen(function* inServer() {
          const workspaceId = yield* freshWorkspace;

          yield* choosing(workspaceId);

          const job = yield* asking(workspaceId);

          yield* eventually("the job ends", jobEnded(job.id));

          assert.deepStrictEqual(
            yield* statusOf(job.id),
            Option.some({ reason: Option.none(), status: "succeeded" as const })
          );

          yield* GenerateVideoV1.execute(
            { generationId: job.id },
            { detached: true, discard: true }
          );

          assert.strictEqual(yield* Ref.get(provider.calls), 1);

          // The job's payload is its id: its prompt is never in the cluster.
          const { journal } = yield* MessageStorage.MemoryDriver;

          assert.notInclude(JSON.stringify(journal), "synthetic harbour");
        }).pipe(Effect.scoped, Effect.provideContext(built));

        yield* shutDown(scope);
      }),
    timeout
  );

  it.effect(
    "fails a job a restart cut short, never asking the provider again",
    () =>
      Effect.gen(function* restarted() {
        const provider = yield* providerWith(Effect.never);
        const storage = yield* Layer.build(MessageStorage.MemoryDriver.layer);
        const driver = Context.get(storage, MessageStorage.MemoryDriver);

        const server = serverOver(
          Layer.succeed(MessageStorage.MessageStorage, driver.storage)
        ).pipe(Layer.provide(Layer.succeed(Provider, provider)));

        const before = yield* Scope.make();
        const first = yield* Layer.buildWithScope(server, before);

        const job = yield* Effect.gen(function* firstServer() {
          const workspaceId = yield* freshWorkspace;

          yield* choosing(workspaceId);

          const asked = yield* asking(workspaceId);

          yield* eventually(
            "the provider is making it",
            Ref.get(provider.calls).pipe(Effect.map((calls) => calls === 1))
          );

          return asked;
        }).pipe(Effect.provideContext(first));

        // The server stops while the provider makes the video.
        yield* shutDown(before);

        const after = yield* Scope.make();
        const second = yield* Layer.buildWithScope(server, after);

        yield* Effect.gen(function* secondServer() {
          yield* eventually("the job ends", jobEnded(job.id));

          assert.deepStrictEqual(
            yield* statusOf(job.id),
            Option.some({
              reason: Option.some("interrupted" as const),
              status: "failed" as const,
            })
          );
          assert.strictEqual(yield* Ref.get(provider.calls), 1);
        }).pipe(Effect.provideContext(second));

        yield* shutDown(after);
      }),
    timeout
  );
});
