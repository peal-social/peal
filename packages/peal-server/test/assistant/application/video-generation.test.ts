import { assert, layer } from "@effect/vitest";
import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Ref,
} from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { AssistantVideos } from "#assistant/application/assistant-videos.ts";
import type { VideoAsked } from "#assistant/application/assistant-videos.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { OwnVideoModel } from "#assistant/application/ports/own-video-model.ts";
import type {
  OwnVideoEndpoint,
  VideoRequest,
} from "#assistant/application/ports/own-video-model.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { VideoGenerationStore } from "#assistant/application/ports/video-generation-store.ts";
import { VideoSlots } from "#assistant/application/ports/video-slots.ts";
import { RunVideoGeneration } from "#assistant/application/run-video-generation.ts";
import { VideoFailed } from "#assistant/application/video-failed.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import { videosPerDay } from "#assistant/domain/video-limits.ts";
import type { VideoProviderId } from "#assistant/domain/video-provider.ts";
import { Actor } from "#shared/domain/access.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  actorIn,
  DatabaseTest,
  freshWorkspace,
  ImageProvidersTest,
} from "#test/assistant/support.ts";
import {
  storedVideoId,
  VideoRecords,
  videoPortsTest,
} from "#test/assistant/video-support.ts";
import type { LibraryScript } from "#test/assistant/video-support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The video use cases and the job's run on the real store in Postgres,
// with the workspace's providers sealed as the server keeps them, a
// scripted library and a scripted video model, which no request leaves.

/** How the scripted provider answers, and what it was asked. */
class FakeVideoModel extends Context.Service<
  FakeVideoModel,
  {
    readonly asked: Ref.Ref<
      readonly { endpoint: OwnVideoEndpoint; request: VideoRequest }[]
    >;
    readonly answer: Ref.Ref<Effect.Effect<Uint8Array, VideoFailed>>;
  }
>()("test/assistant/FakeVideoModel") {}

const videoBytes = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

const FakeVideoModelLive = Layer.effect(
  OwnVideoModel,
  FakeVideoModel.use(({ answer, asked }) =>
    Effect.succeed(
      OwnVideoModel.of({
        generate: (endpoint, request) =>
          Ref.update(asked, (all) => [...all, { endpoint, request }]).pipe(
            Effect.andThen(Ref.get(answer)),
            Effect.flatten
          ),
      })
    )
  )
).pipe(
  Layer.provideMerge(
    Layer.effect(
      FakeVideoModel,
      Effect.gen(function* FakeVideoModelState() {
        return FakeVideoModel.of({
          answer: yield* Ref.make<Effect.Effect<Uint8Array, VideoFailed>>(
            Effect.succeed(videoBytes)
          ),
          asked: yield* Ref.make<
            readonly { endpoint: OwnVideoEndpoint; request: VideoRequest }[]
          >([]),
        });
      })
    )
  )
);

const videosTest = (library: LibraryScript = {}) =>
  Layer.mergeAll(AssistantVideos.layer, RunVideoGeneration.layer).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        videoPortsTest(library),
        FakeVideoModelLive,
        VideoSlots.layer
      )
    ),
    Layer.provideMerge(ImageProvidersTest)
  );

const asked = (overrides: Partial<VideoAsked> = {}): VideoAsked => ({
  aspect: "landscape",
  durationSeconds: 6,
  imageMediaId: null,
  prompt: "A synthetic harbour at dawn.",
  ...overrides,
});

const editorIn = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, permissionsFor("editor"));

// A workspace that chose `provider` for videos, its key sealed.
const choosing = (
  workspaceId: WorkspaceId,
  provider: VideoProviderId = "xai",
  apiKey = "sk_test_synthetic_video_key"
) =>
  Effect.gen(function* choose() {
    const now = yield* DateTime.now;

    yield* ProviderConnections.use((connections) =>
      connections.save(
        workspaceId,
        new ProviderConnectionSettings({
          baseUrl: ProviderAddressSchema.make(
            provider === "xai"
              ? "https://api.x.ai/v1"
              : "https://generativelanguage.googleapis.com/v1beta"
          ),
          provider,
          updatedAt: now,
        }),
        Redacted.make(apiKey)
      )
    ).pipe(Effect.orDie);

    yield* CapabilityModels.use((models) =>
      models.set(
        workspaceId,
        new CapabilityModelSettings({
          capability: "video",
          model: ProviderModelSchema.make("grok-imagine-video"),
          provider,
          updatedAt: now,
        })
      )
    );
  });

// Tests run on TestClock from its own start (1970's first day, 10:00):
// setting it years ahead would wake every timer of the layers in between.
const workspaceWithVideos = (provider: VideoProviderId = "xai") =>
  Effect.gen(function* workspace() {
    yield* TestClock.adjust(Duration.hours(10));

    const workspaceId = yield* freshWorkspace;

    yield* choosing(workspaceId, provider);

    return workspaceId;
  });

const requesting = (actor: Actor, request: VideoAsked = asked()) =>
  AssistantVideos.use((videos) => videos.request(actor, request));

const running = (id: Parameters<RunVideoGeneration["Service"]["run"]>[0]) =>
  RunVideoGeneration.use((runs) => runs.run(id));

const promptOf = (id: string) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap(
      (sql) =>
        sql<{
          readonly prompt: string | null;
        }>`SELECT prompt FROM assistant.video_generations WHERE id = ${id}`
    ),
    Effect.map((rows) => rows[0]?.prompt ?? null)
  );

layer(DatabaseTest, { timeout: "60 seconds" })("asking for a video", (it) => {
  it.effect(
    "records a queued job and starts it, the prompt kept beside it",
    () =>
      Effect.gen(function* queues() {
        const workspaceId = yield* workspaceWithVideos();
        const generation = yield* requesting(editorIn(workspaceId));
        const records = yield* VideoRecords;

        assert.strictEqual(generation.status, "queued");
        assert.deepStrictEqual(yield* Ref.get(records.started), [
          generation.id,
        ]);
        assert.strictEqual(
          yield* promptOf(generation.id),
          "A synthetic harbour at dawn."
        );

        const listed = yield* AssistantVideos.use((videos) =>
          videos.list(editorIn(workspaceId), Option.some("queued"))
        );

        assert.deepStrictEqual(
          listed.map(({ id }) => id),
          [generation.id]
        );

        const status = yield* AssistantVideos.use((videos) =>
          videos.status(editorIn(workspaceId))
        );

        assert.deepStrictEqual(status, {
          available: true,
          dailyLimit: videosPerDay,
          maxPromptLength: 1000,
          provider: "xai",
          remaining: videosPerDay - 1,
        });
      }).pipe(Effect.provide(videosTest()))
  );

  it.effect(
    "needs assistant:use and media:upload, and refuses staff acting as a member",
    () =>
      Effect.gen(function* permissions() {
        const workspaceId = yield* workspaceWithVideos();

        const viewer = yield* requesting(
          actorIn(workspaceId, permissionsFor("viewer"))
        ).pipe(Effect.flip);

        assert.strictEqual(viewer._tag, "MissingPermission");

        const noUpload = yield* requesting(
          actorIn(
            workspaceId,
            permissionsFor("editor").filter((each) => each !== "media:upload")
          )
        ).pipe(Effect.flip);

        assert.deepInclude(noUpload, { permission: "media:upload" });

        const staff = new Actor({
          permissions: permissionsFor("editor"),
          subject: {
            _tag: "user",
            impersonatedBy: Option.some(
              UserIdSchema.make("6c2d6a8f-4e3b-4d2c-8f9a-8b7c6d5e4f3a")
            ),
            userId: UserIdSchema.make("5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"),
          },
          workspaceId,
        });

        const impersonated = yield* requesting(staff).pipe(Effect.flip);

        assert.strictEqual(impersonated._tag, "MissingPermission");
      }).pipe(Effect.provide(videosTest()))
  );

  it.effect(
    "refuses what the provider does not make, before anything is recorded",
    () =>
      Effect.gen(function* refusals() {
        const workspaceId = yield* workspaceWithVideos("google");
        const actor = editorIn(workspaceId);

        const square = yield* requesting(
          actor,
          asked({ aspect: "square" })
        ).pipe(Effect.flip);

        assert.deepInclude(square, { reason: "aspectNotOffered" });

        // Veo picks its own length.
        const length = yield* requesting(
          actor,
          asked({ durationSeconds: 6 })
        ).pipe(Effect.flip);

        assert.deepInclude(length, { reason: "durationNotOffered" });

        const image = yield* requesting(
          actor,
          asked({
            durationSeconds: null,
            imageMediaId: "019a0000-0000-7000-8000-00000000bad0",
          })
        ).pipe(Effect.flip);

        assert.deepInclude(image, { reason: "imageNotFound" });

        const blank = yield* requesting(
          actor,
          asked({ durationSeconds: null, prompt: "   " })
        ).pipe(Effect.flip);

        assert.strictEqual(blank._tag, "DraftRejected");

        const records = yield* VideoRecords;

        assert.lengthOf(yield* Ref.get(records.started), 0);
      }).pipe(Effect.provide(videosTest()))
  );

  it.effect("is off without a provider chosen for videos", () =>
    Effect.gen(function* unavailable() {
      const workspaceId = yield* freshWorkspace;
      const notSet = yield* requesting(editorIn(workspaceId)).pipe(Effect.flip);

      assert.deepInclude(notSet, {
        _tag: "VideoUnavailable",
        reason: "notSet",
      });

      const status = yield* AssistantVideos.use((videos) =>
        videos.status(editorIn(workspaceId))
      );

      assert.isFalse(status.available);
      assert.isNull(status.provider);
    }).pipe(Effect.provide(videosTest()))
  );

  it.effect("refuses a full plan before anything is asked", () =>
    Effect.gen(function* full() {
      const workspaceId = yield* workspaceWithVideos();

      const refused = yield* requesting(editorIn(workspaceId)).pipe(
        Effect.flip
      );

      assert.strictEqual(refused._tag, "PlanLimitReached");
    }).pipe(Effect.provide(videosTest({ room: false })))
  );

  it.effect("makes one video at a time, and gives a lost job's turn back", () =>
    Effect.gen(function* oneAtATime() {
      const workspaceId = yield* workspaceWithVideos();
      const actor = editorIn(workspaceId);
      const first = yield* requesting(actor);
      const busy = yield* requesting(actor).pipe(Effect.flip);

      assert.deepInclude(busy, { _tag: "VideoBusy", generationId: first.id });

      // Its server stopped and its job never ran again: half an hour on,
      // it is failed and told, and the next one starts.
      yield* TestClock.adjust(Duration.minutes(31));

      const second = yield* requesting(actor);
      const records = yield* VideoRecords;

      const lost = yield* AssistantVideos.use((videos) =>
        videos.view(actor, first.id)
      );

      assert.strictEqual(second.status, "queued");
      assert.strictEqual(lost.status, "failed");
      assert.deepStrictEqual(lost.reason, Option.some("interrupted"));
      assert.isNull(yield* promptOf(first.id));
      assert.deepStrictEqual(
        (yield* Ref.get(records.told)).map(({ id }) => id),
        [first.id]
      );
    }).pipe(Effect.provide(videosTest()))
  );

  it.effect(
    "asks for no more than the day allows, whatever each ended with",
    () =>
      Effect.gen(function* allowance() {
        const workspaceId = yield* workspaceWithVideos();
        const actor = editorIn(workspaceId);
        const store = yield* VideoGenerationStore;

        for (let made = 0; made < videosPerDay; made += 1) {
          const generation = yield* requesting(actor);

          yield* store.settle(
            generation.id,
            { _tag: "failed", reason: "refused" },
            yield* DateTime.now
          );
        }

        const refused = yield* requesting(actor).pipe(Effect.flip);

        assert.deepInclude(refused, {
          _tag: "VideosExhausted",
          dailyLimit: videosPerDay,
        });

        // The next UTC day counts again.
        yield* TestClock.adjust(Duration.hours(14));

        assert.strictEqual((yield* requesting(actor)).status, "queued");
      }).pipe(Effect.provide(videosTest()))
  );
});

layer(DatabaseTest, { timeout: "60 seconds" })("a video's job", (it) => {
  it.effect(
    "makes the video once, keeps it in the library and tells who asked",
    () =>
      Effect.gen(function* succeeds() {
        const workspaceId = yield* workspaceWithVideos();
        const generation = yield* requesting(editorIn(workspaceId));

        assert.strictEqual(yield* running(generation.id), "succeeded");

        const { asked: calls } = yield* FakeVideoModel;
        const made = yield* Ref.get(calls);

        assert.lengthOf(made, 1);
        assert.deepInclude(made[0]?.request, {
          durationSeconds: 6,
          prompt: "A synthetic harbour at dawn.",
          ratio: "16:9",
        });
        assert.strictEqual(
          Redacted.value(made[0]?.endpoint.apiKey ?? Redacted.make("")),
          "sk_test_synthetic_video_key"
        );

        const ended = yield* AssistantVideos.use((videos) =>
          videos.view(editorIn(workspaceId), generation.id)
        );

        const records = yield* VideoRecords;

        assert.strictEqual(ended.status, "succeeded");
        assert.deepStrictEqual(ended.mediaId, Option.some(storedVideoId));
        assert.isNull(yield* promptOf(generation.id));
        assert.deepStrictEqual(yield* Ref.get(records.stored), [videoBytes]);
        assert.deepStrictEqual(
          (yield* Ref.get(records.told)).map(({ id, status }) => ({
            id,
            status,
          })),
          [{ id: generation.id, status: "succeeded" }]
        );

        // Run again, it does nothing more.
        assert.strictEqual(yield* running(generation.id), "superseded");
        assert.lengthOf(yield* Ref.get(calls), 1);
      }).pipe(Effect.provide(videosTest()))
  );

  it.effect("fails a job the provider refused, asked once, never again", () =>
    Effect.gen(function* refused() {
      const workspaceId = yield* workspaceWithVideos();
      const generation = yield* requesting(editorIn(workspaceId));
      const model = yield* FakeVideoModel;

      yield* Ref.set(
        model.answer,
        Effect.fail(new VideoFailed({ reason: "settingsRefused" }))
      );

      assert.strictEqual(yield* running(generation.id), "failed");
      assert.strictEqual(yield* running(generation.id), "superseded");
      assert.lengthOf(yield* Ref.get(model.asked), 1);

      const ended = yield* AssistantVideos.use((videos) =>
        videos.view(editorIn(workspaceId), generation.id)
      );

      assert.deepStrictEqual(ended.reason, Option.some("settingsRefused"));
      assert.isNull(yield* promptOf(generation.id));
    }).pipe(Effect.provide(videosTest()))
  );

  it.effect("fails a job its server stopped during, without asking again", () =>
    Effect.gen(function* interrupted() {
      const workspaceId = yield* workspaceWithVideos();
      const generation = yield* requesting(editorIn(workspaceId));
      const store = yield* VideoGenerationStore;

      // A run took it, then its server stopped.
      yield* store.claim(generation.id, yield* DateTime.now);

      assert.strictEqual(yield* running(generation.id), "failed");

      const ended = yield* AssistantVideos.use((videos) =>
        videos.view(editorIn(workspaceId), generation.id)
      );

      const model = yield* FakeVideoModel;
      const records = yield* VideoRecords;

      assert.deepStrictEqual(ended.reason, Option.some("interrupted"));
      assert.lengthOf(yield* Ref.get(model.asked), 0);
      assert.lengthOf(yield* Ref.get(records.told), 1);
    }).pipe(Effect.provide(videosTest()))
  );

  it.effect("fails a job whose first frame is gone", () =>
    Effect.gen(function* gone() {
      const workspaceId = yield* workspaceWithVideos();

      const generation = yield* requesting(
        editorIn(workspaceId),
        asked({ imageMediaId: "019a0000-0000-7000-8000-00000000f1a0" })
      );

      assert.strictEqual(yield* running(generation.id), "failed");

      const ended = yield* AssistantVideos.use((videos) =>
        videos.view(editorIn(workspaceId), generation.id)
      );

      assert.deepStrictEqual(ended.reason, Option.some("imageUnavailable"));
    }).pipe(
      Effect.provide(
        videosTest({
          // Taken when asked for, gone when the job runs.
          firstFrames: false,
          images: new Map([
            [
              "019a0000-0000-7000-8000-00000000f1a0",
              { bytes: Uint8Array.from([1]), mediaType: "image/png" },
            ],
          ]),
        })
      )
    )
  );
});
