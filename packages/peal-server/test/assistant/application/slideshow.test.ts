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
  Schema,
} from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { AssistantSlideshows } from "#assistant/application/assistant-slideshows.ts";
import type { SlideshowAsked } from "#assistant/application/assistant-slideshows.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { OwnComposer } from "#assistant/application/ports/own-composer.ts";
import type {
  CompositionRequest,
  OwnComposerEndpoint,
} from "#assistant/application/ports/own-composer.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { SlideshowSlots } from "#assistant/application/ports/slideshow-slots.ts";
import { SlideshowStore } from "#assistant/application/ports/slideshow-store.ts";
import { RunSlideshow } from "#assistant/application/run-slideshow.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import { compositionModel } from "#assistant/domain/composition-provider.ts";
import { withValues } from "#assistant/domain/edit-render.ts";
import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import { slideshowsPerDay } from "#assistant/domain/slideshow-limits.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { Actor } from "#shared/domain/access.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  audioFile,
  imageFile,
  SlideshowRecords,
  slideshowPortsTest,
  storedSlideshowId,
} from "#test/assistant/slideshow-support.ts";
import type { SlideshowLibraryScript } from "#test/assistant/slideshow-support.ts";
import {
  actorIn,
  DatabaseTest,
  freshWorkspace,
  ImageProvidersTest,
} from "#test/assistant/support.ts";
import { fakeMeters } from "#test/shared/fake-meters.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The slide video use cases and the job's run on the real store in
// Postgres, with the workspace's Shotstack connection sealed as the server
// keeps it, a scripted library and a scripted composer, which no request
// leaves.

/** How the scripted service answers, and what it was asked. */
class FakeComposer extends Context.Service<
  FakeComposer,
  {
    readonly asked: Ref.Ref<
      readonly {
        endpoint: OwnComposerEndpoint;
        request: CompositionRequest;
      }[]
    >;
    readonly answer: Ref.Ref<Effect.Effect<Uint8Array, SlideshowFailed>>;
  }
>()("test/assistant/FakeComposer") {}

const videoBytes = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

const FakeComposerLive = Layer.effect(
  OwnComposer,
  FakeComposer.use(({ answer, asked }) =>
    Effect.succeed(
      OwnComposer.of({
        compose: (endpoint, request) =>
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
      FakeComposer,
      Effect.gen(function* FakeComposerState() {
        return FakeComposer.of({
          answer: yield* Ref.make<Effect.Effect<Uint8Array, SlideshowFailed>>(
            Effect.succeed(videoBytes)
          ),
          asked: yield* Ref.make<
            readonly {
              endpoint: OwnComposerEndpoint;
              request: CompositionRequest;
            }[]
          >([]),
        });
      })
    )
  )
);

const first = "019a0000-0000-7000-8000-00000000c001";
const second = "019a0000-0000-7000-8000-00000000c002";
const gif = "019a0000-0000-7000-8000-00000000c003";
const voice = "019a0000-0000-7000-8000-00000000c004";
const longVoice = "019a0000-0000-7000-8000-00000000c005";

const library: SlideshowLibraryScript = {
  files: new Map([
    [first, imageFile("image/jpeg")],
    [second, imageFile("image/png")],
    [gif, imageFile("image/gif")],
    [voice, audioFile(13)],
    [longVoice, audioFile(150)],
  ]),
};

const slideshowsTest = ({
  meters = MeteredUsage.layerUnmetered,
  script = library,
}: {
  readonly meters?: Layer.Layer<MeteredUsage>;
  readonly script?: SlideshowLibraryScript;
} = {}) =>
  Layer.mergeAll(AssistantSlideshows.layer, RunSlideshow.layer).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        slideshowPortsTest(script),
        FakeComposerLive,
        SlideshowSlots.layer,
        meters
      )
    ),
    Layer.provideMerge(ImageProvidersTest)
  );

const asked = (overrides: Partial<SlideshowAsked> = {}): SlideshowAsked => ({
  aspect: "portrait",
  secondsPerSlide: null,
  slides: [
    { caption: "  A synthetic harbour  ", mediaId: first, motion: "zoomIn" },
    { caption: null, mediaId: second, motion: "none" },
  ],
  transition: "fade",
  voiceoverMediaId: null,
  ...overrides,
});

// A slide of an image alone.
const slide = (mediaId: string) => ({
  caption: null,
  mediaId,
  motion: "none" as const,
});

const editorIn = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, permissionsFor("editor"));

const production = "https://api.shotstack.io/edit/v1";
const sandbox = "https://api.shotstack.io/edit/stage";

// A workspace that chose Shotstack for slide videos, its key sealed.
const choosing = (workspaceId: WorkspaceId, address = production) =>
  Effect.gen(function* choose() {
    const now = yield* DateTime.now;

    yield* ProviderConnections.use((connections) =>
      connections.save(
        workspaceId,
        new ProviderConnectionSettings({
          baseUrl: ProviderAddressSchema.make(address),
          provider: "shotstack",
          updatedAt: now,
        }),
        Redacted.make("synthetic-shotstack-key")
      )
    ).pipe(Effect.orDie);

    yield* CapabilityModels.use((models) =>
      models.set(
        workspaceId,
        new CapabilityModelSettings({
          capability: "composition",
          model: ProviderModelSchema.make(compositionModel),
          provider: "shotstack",
          updatedAt: now,
        })
      )
    );
  });

// Tests run on TestClock from its own start: a few hours in, never years.
const workspaceComposing = (address = production) =>
  Effect.gen(function* workspace() {
    yield* TestClock.adjust(Duration.hours(10));

    const workspaceId = yield* freshWorkspace;

    yield* choosing(workspaceId, address);

    return workspaceId;
  });

const requesting = (actor: Actor, request: SlideshowAsked = asked()) =>
  AssistantSlideshows.use((slideshows) => slideshows.request(actor, request));

const running = (id: Parameters<RunSlideshow["Service"]["run"]>[0]) =>
  RunSlideshow.use((runs) => runs.run(id));

const planOf = (id: string) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap(
      (sql) =>
        sql<{
          readonly plan: unknown;
        }>`SELECT plan FROM assistant.slideshows WHERE id = ${id}`
    ),
    Effect.map((rows) => rows[0]?.plan ?? null)
  );

layer(DatabaseTest, { timeout: "60 seconds" })(
  "asking for a slide video",
  (it) => {
    it.effect(
      "records a queued job and starts it, the plan kept beside it",
      () =>
        Effect.gen(function* queues() {
          const workspaceId = yield* workspaceComposing();
          const slideshow = yield* requesting(editorIn(workspaceId));
          const records = yield* SlideshowRecords;

          assert.strictEqual(slideshow.status, "queued");
          assert.strictEqual(slideshow.durationSeconds, 8);
          assert.isFalse(slideshow.sandbox);
          assert.deepStrictEqual<readonly string[]>(slideshow.imageMediaIds, [
            first,
            second,
          ]);
          assert.deepStrictEqual(yield* Ref.get(records.started), [
            slideshow.id,
          ]);
          assert.deepStrictEqual(yield* planOf(slideshow.id), {
            secondsPerSlide: 4,
            slides: [
              {
                caption: "A synthetic harbour",
                mediaId: first,
                motion: "zoomIn",
              },
              { caption: null, mediaId: second, motion: "none" },
            ],
            transition: "fade",
          });

          const status = yield* AssistantSlideshows.use((slideshows) =>
            slideshows.status(editorIn(workspaceId))
          );

          assert.deepStrictEqual(status, {
            available: true,
            dailyLimit: slideshowsPerDay,
            paymentMethodRequired: false,
            provider: "shotstack",
            remaining: slideshowsPerDay - 1,
            sandbox: false,
          });
        }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect("fits the slides to the voice-over, and says a sandbox", () =>
      Effect.gen(function* fitted() {
        const workspaceId = yield* workspaceComposing(sandbox);

        const slideshow = yield* requesting(
          editorIn(workspaceId),
          asked({ voiceoverMediaId: voice })
        );

        assert.strictEqual(slideshow.durationSeconds, 13);
        assert.isTrue(slideshow.sandbox);
        assert.deepStrictEqual(slideshow.voiceoverMediaId, Option.some(voice));
        assert.deepInclude(yield* planOf(slideshow.id), {
          secondsPerSlide: 6.5,
        });
      }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect(
      "refuses what cannot be composed, before anything is recorded",
      () =>
        Effect.gen(function* refusals() {
          const workspaceId = yield* workspaceComposing();
          const actor = editorIn(workspaceId);

          const reasonOf = (request: SlideshowAsked) =>
            requesting(actor, request).pipe(
              Effect.flip,
              Effect.map((failure) =>
                "reason" in failure ? failure.reason : failure._tag
              )
            );

          assert.strictEqual(
            yield* reasonOf(
              asked({ slides: [slide(first), slide("not-a-media-id")] })
            ),
            "imageNotFound"
          );
          assert.strictEqual(
            yield* reasonOf(asked({ slides: [slide(first), slide(voice)] })),
            "imageNotFound"
          );
          assert.strictEqual(
            yield* reasonOf(asked({ slides: [slide(first), slide(gif)] })),
            "imageNotSupported"
          );
          assert.strictEqual(
            yield* reasonOf(asked({ voiceoverMediaId: first })),
            "voiceoverNotFound"
          );
          assert.strictEqual(
            yield* reasonOf(asked({ voiceoverMediaId: longVoice })),
            "voiceoverTooLong"
          );
          assert.strictEqual(
            yield* reasonOf(
              asked({
                secondsPerSlide: 10,
                slides: Array.from({ length: 10 }, () => slide(first)),
              })
            ),
            "tooLong"
          );

          const records = yield* SlideshowRecords;

          assert.lengthOf(yield* Ref.get(records.started), 0);
        }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect(
      "needs assistant:use and media:upload, and refuses staff acting as a member",
      () =>
        Effect.gen(function* permissions() {
          const workspaceId = yield* workspaceComposing();

          const viewer = yield* requesting(
            actorIn(workspaceId, permissionsFor("viewer"))
          ).pipe(Effect.flip);

          assert.strictEqual(viewer._tag, "MissingPermission");

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
        }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect("is off without Shotstack chosen", () =>
      Effect.gen(function* unavailable() {
        const workspaceId = yield* freshWorkspace;

        const notSet = yield* requesting(editorIn(workspaceId)).pipe(
          Effect.flip
        );

        assert.deepInclude(notSet, {
          _tag: "CompositionUnavailable",
          reason: "notSet",
        });

        const status = yield* AssistantSlideshows.use((slideshows) =>
          slideshows.status(editorIn(workspaceId))
        );

        assert.isFalse(status.available);
        assert.isNull(status.provider);
      }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect(
      "refuses a billing account without a payment method, before anything is recorded",
      () =>
        Effect.gen(function* unpaid() {
          const workspaceId = yield* workspaceComposing();

          const refused = yield* requesting(editorIn(workspaceId)).pipe(
            Effect.flip
          );

          assert.strictEqual(refused._tag, "CompositionNeedsPayment");

          const status = yield* AssistantSlideshows.use((slideshows) =>
            slideshows.status(editorIn(workspaceId))
          );

          // Still offered, so clients offer the upgrade instead.
          assert.isTrue(status.available);
          assert.isTrue(status.paymentMethodRequired);

          const records = yield* SlideshowRecords;

          assert.lengthOf(yield* Ref.get(records.started), 0);
        }).pipe(
          Effect.provide(
            slideshowsTest({
              meters: fakeMeters({
                allowed: Option.none(),
                paymentMethod: false,
              }),
            })
          )
        )
    );

    it.effect("takes a billing account that pays", () =>
      Effect.gen(function* paid() {
        const workspaceId = yield* workspaceComposing();
        const slideshow = yield* requesting(editorIn(workspaceId));

        assert.strictEqual(slideshow.status, "queued");
      }).pipe(
        Effect.provide(
          slideshowsTest({
            meters: fakeMeters({ allowed: Option.none(), paymentMethod: true }),
          })
        )
      )
    );

    it.effect("composes one at a time a workspace", () =>
      Effect.gen(function* busy() {
        const workspaceId = yield* workspaceComposing();
        const actor = editorIn(workspaceId);
        const queued = yield* requesting(actor);
        const refused = yield* requesting(actor).pipe(Effect.flip);

        assert.deepInclude(refused, {
          _tag: "CompositionBusy",
          slideshowId: queued.id,
        });
      }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect(
      "asks for no more than the day allows, whatever each ended with",
      () =>
        Effect.gen(function* allowance() {
          const workspaceId = yield* workspaceComposing();
          const actor = editorIn(workspaceId);
          const store = yield* SlideshowStore;

          for (let made = 0; made < slideshowsPerDay; made += 1) {
            const slideshow = yield* requesting(actor);

            yield* store.settle(
              slideshow.id,
              { _tag: "failed", reason: "refused" },
              yield* DateTime.now
            );
          }

          const refused = yield* requesting(actor).pipe(Effect.flip);

          assert.deepInclude(refused, {
            _tag: "SlideshowsExhausted",
            dailyLimit: slideshowsPerDay,
          });

          // The next UTC day counts again.
          yield* TestClock.adjust(Duration.hours(24));

          assert.strictEqual((yield* requesting(actor)).status, "queued");
        }).pipe(Effect.provide(slideshowsTest()))
    );

    it.effect("refuses a plan without room for the video", () =>
      Effect.gen(function* full() {
        const workspaceId = yield* workspaceComposing();

        const refused = yield* requesting(editorIn(workspaceId)).pipe(
          Effect.flip
        );

        assert.strictEqual(refused._tag, "PlanLimitReached");
      }).pipe(
        Effect.provide(slideshowsTest({ script: { ...library, room: false } }))
      )
    );
  }
);

layer(DatabaseTest, { timeout: "60 seconds" })("a slide video's job", (it) => {
  it.effect(
    "composes once with links for this request's files, keeps the video and tells who asked",
    () =>
      Effect.gen(function* succeeds() {
        const workspaceId = yield* workspaceComposing();

        const slideshow = yield* requesting(
          editorIn(workspaceId),
          asked({ voiceoverMediaId: voice })
        );

        assert.strictEqual(yield* running(slideshow.id), "succeeded");

        const composer = yield* FakeComposer;
        const calls = yield* Ref.get(composer.asked);
        const records = yield* SlideshowRecords;

        assert.lengthOf(calls, 1);
        assert.strictEqual(calls[0]?.endpoint.baseUrl, production);
        assert.strictEqual(
          Redacted.value(calls[0]?.endpoint.apiKey ?? Redacted.make("")),
          "synthetic-shotstack-key"
        );
        assert.deepStrictEqual(calls[0]?.request, {
          aspect: "portrait",
          secondsPerSlide: 6.5,
          slides: [
            {
              caption: "A synthetic harbour",
              imageUrl: `https://media.example.com/signed/${first}`,
              motion: "zoomIn",
            },
            {
              caption: null,
              imageUrl: `https://media.example.com/signed/${second}`,
              motion: "none",
            },
          ],
          transition: "fade",
          voiceoverUrl: `https://media.example.com/signed/${voice}`,
        });

        // Each link works an hour, for this request's three files alone.
        assert.deepStrictEqual(
          (yield* Ref.get(records.linked)).map(([, seconds]) => seconds),
          [3600, 3600, 3600]
        );

        const ended = yield* AssistantSlideshows.use((slideshows) =>
          slideshows.view(editorIn(workspaceId), slideshow.id)
        );

        assert.strictEqual(ended.status, "succeeded");
        assert.deepStrictEqual(ended.mediaId, Option.some(storedSlideshowId));
        assert.isNull(yield* planOf(slideshow.id));
        assert.deepStrictEqual(yield* Ref.get(records.stored), [videoBytes]);
        assert.deepStrictEqual(
          (yield* Ref.get(records.told)).map(({ id, status }) => ({
            id,
            status,
          })),
          [{ id: slideshow.id, status: "succeeded" }]
        );

        // Run again, it does nothing more.
        assert.strictEqual(yield* running(slideshow.id), "superseded");
        assert.lengthOf(yield* Ref.get(composer.asked), 1);
      }).pipe(Effect.provide(slideshowsTest()))
  );

  it.effect("fails a job the service refused, sent once, never again", () =>
    Effect.gen(function* refused() {
      const workspaceId = yield* workspaceComposing();
      const slideshow = yield* requesting(editorIn(workspaceId));
      const composer = yield* FakeComposer;

      yield* Ref.set(
        composer.answer,
        Effect.fail(new SlideshowFailed({ reason: "settingsRefused" }))
      );

      assert.strictEqual(yield* running(slideshow.id), "failed");
      assert.strictEqual(yield* running(slideshow.id), "superseded");
      assert.lengthOf(yield* Ref.get(composer.asked), 1);

      const ended = yield* AssistantSlideshows.use((slideshows) =>
        slideshows.view(editorIn(workspaceId), slideshow.id)
      );

      assert.deepStrictEqual(ended.reason, Option.some("settingsRefused"));
      assert.isNull(yield* planOf(slideshow.id));
    }).pipe(Effect.provide(slideshowsTest()))
  );

  it.effect(
    "fails a job its server stopped during, without sending again",
    () =>
      Effect.gen(function* interrupted() {
        const workspaceId = yield* workspaceComposing();
        const slideshow = yield* requesting(editorIn(workspaceId));
        const store = yield* SlideshowStore;

        // A run took it, then its server stopped.
        yield* store.claim(slideshow.id, yield* DateTime.now);

        assert.strictEqual(yield* running(slideshow.id), "failed");

        const ended = yield* AssistantSlideshows.use((slideshows) =>
          slideshows.view(editorIn(workspaceId), slideshow.id)
        );

        const composer = yield* FakeComposer;
        const records = yield* SlideshowRecords;

        assert.deepStrictEqual(ended.reason, Option.some("interrupted"));
        assert.lengthOf(yield* Ref.get(composer.asked), 0);
        assert.lengthOf(yield* Ref.get(records.told), 1);
      }).pipe(Effect.provide(slideshowsTest()))
  );

  it.effect("fails a job whose files can no longer be linked", () =>
    Effect.gen(function* gone() {
      const workspaceId = yield* workspaceComposing();
      const slideshow = yield* requesting(editorIn(workspaceId));

      assert.strictEqual(yield* running(slideshow.id), "failed");

      const ended = yield* AssistantSlideshows.use((slideshows) =>
        slideshows.view(editorIn(workspaceId), slideshow.id)
      );

      const composer = yield* FakeComposer;

      assert.deepStrictEqual(ended.reason, Option.some("mediaUnavailable"));
      assert.lengthOf(yield* Ref.get(composer.asked), 0);
    }).pipe(
      Effect.provide(slideshowsTest({ script: { ...library, links: false } }))
    )
  );
});

// A whole Shotstack Edit, as the web app's editor writes it: a title, an
// image then a video, a voice-over to the end, a Google font.
const clipFile = "019a0000-0000-7000-8000-00000000c006";

const editLibrary: SlideshowLibraryScript = {
  files: new Map([
    ...(library.files ?? new Map()),
    [
      clipFile,
      {
        contentType: "video/mp4",
        durationSeconds: Option.some(8),
        kind: "video",
      },
    ],
  ]),
};

const media = (id: string) => `peal:media/${id}`;

const anEdit = (): Schema.JsonObject => ({
  output: { aspectRatio: "9:16" },
  timeline: {
    fonts: [{ src: "https://fonts.gstatic.com/s/synthetic/v1/synthetic.ttf" }],
    tracks: [
      {
        clips: [
          {
            asset: { text: "A synthetic harbour", type: "rich-text" },
            length: 3,
            start: 0,
          },
        ],
      },
      {
        clips: [
          { asset: { src: media(first), type: "image" }, length: 4, start: 0 },
          {
            asset: { src: media(clipFile), type: "video" },
            length: 6.5,
            start: "4",
          },
        ],
      },
      {
        clips: [
          {
            asset: { src: media(voice), type: "audio" },
            length: "end",
            start: 0,
          },
        ],
      },
    ],
  },
});

// The edit with one clip in place of its tracks, in 16:9 unless the
// output says.
const editOf = (
  clip: Schema.Json,
  output?: Schema.Json
): Schema.JsonObject => ({
  output: output ?? { aspectRatio: "16:9" },
  timeline: { tracks: [{ clips: [clip] }] },
});

// An image of the library in 16:9, with the edit's other parts given.
const imageEditWith = (around: {
  readonly fonts?: Schema.Json;
  readonly merge?: Schema.Json;
  readonly soundtrack?: Schema.Json;
}): Schema.JsonObject =>
  withValues(
    {
      output: { aspectRatio: "16:9" },
      timeline: withValues(
        { tracks: [{ clips: [imageClip(media(first))] }] },
        { fonts: around.fonts, soundtrack: around.soundtrack }
      ),
    },
    { merge: around.merge }
  );

const imageClip = (src: string, start: Schema.Json = 0, length = 2) => ({
  asset: { src, type: "image" },
  length,
  start,
});

const requestingEdit = (actor: Actor, edit: Schema.JsonObject = anEdit()) =>
  AssistantSlideshows.use((slideshows) => slideshows.requestEdit(actor, edit));

const decodePlanRow = Schema.decodeUnknownSync(
  Schema.Struct({
    edit: Schema.Struct({
      output: Schema.Json,
      timeline: Schema.Struct({
        tracks: Schema.Array(
          Schema.Struct({ clips: Schema.Array(Schema.Json) })
        ),
      }),
    }),
  })
);

layer(DatabaseTest, { timeout: "60 seconds" })(
  "asking for an edit to be rendered",
  (it) => {
    it.effect(
      "records the job with every file it names, its aspect and length, the edit kept as its plan",
      () =>
        Effect.gen(function* queues() {
          const workspaceId = yield* workspaceComposing(sandbox);
          const slideshow = yield* requestingEdit(editorIn(workspaceId));
          const records = yield* SlideshowRecords;

          assert.strictEqual(slideshow.status, "queued");
          assert.strictEqual(slideshow.aspect, "portrait");
          assert.strictEqual(slideshow.durationSeconds, 10.5);
          assert.isTrue(slideshow.sandbox);
          assert.deepStrictEqual<readonly string[]>(slideshow.imageMediaIds, [
            first,
            clipFile,
            voice,
          ]);
          assert.isTrue(Option.isNone(slideshow.voiceoverMediaId));
          assert.deepStrictEqual(yield* Ref.get(records.started), [
            slideshow.id,
          ]);

          const plan = decodePlanRow(yield* planOf(slideshow.id));

          // Peal's output filled in, the files still named as the library's,
          // the start read as a number.
          assert.deepStrictEqual(plan.edit.output, {
            aspectRatio: "9:16",
            format: "mp4",
            resolution: "1080",
          });
          assert.deepStrictEqual(plan.edit.timeline.tracks[1]?.clips[1], {
            asset: { src: media(clipFile), type: "video" },
            length: 6.5,
            start: 4,
          });
        }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
    );

    it.effect(
      "takes a 16:9 1080p MP4 when the output says none, assets Shotstack generates, HTML and captions of another clip",
      () =>
        Effect.gen(function* defaults() {
          const workspaceId = yield* workspaceComposing();

          const slideshow = yield* requestingEdit(editorIn(workspaceId), {
            timeline: {
              tracks: [
                {
                  clips: [
                    {
                      asset: { prompt: "A synthetic harbour", type: "image" },
                      length: 2,
                      start: 0,
                    },
                    {
                      asset: { html: "<p>Synthetic</p>", type: "html" },
                      length: 2,
                      start: 2,
                    },
                    {
                      asset: { src: "alias://voice", type: "rich-caption" },
                      length: "auto",
                      start: "auto",
                    },
                  ],
                },
              ],
            },
          });

          assert.strictEqual(slideshow.aspect, "landscape");
          assert.strictEqual(slideshow.durationSeconds, 4);
          assert.lengthOf(slideshow.imageMediaIds, 0);
        }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
    );

    it.effect(
      "refuses what Peal does not render, before anything is recorded",
      () =>
        Effect.gen(function* refusals() {
          const workspaceId = yield* workspaceComposing();
          const actor = editorIn(workspaceId);

          const reasonOf = (edit: Schema.JsonObject) =>
            requestingEdit(actor, edit).pipe(
              Effect.flip,
              Effect.map((failure) =>
                "reason" in failure ? failure.reason : failure._tag
              )
            );

          const cases: readonly (readonly [Schema.JsonObject, string])[] = [
            // Not an Edit Shotstack's schema accepts.
            [{ timeline: { tracks: [] } }, "editInvalid"],
            [
              editOf({ asset: { type: "image" }, length: 2, start: 0 }),
              "editInvalid",
            ],
            [
              editOf(imageClip("https://media.example.com/synthetic.png")),
              "editInvalid",
            ],
            [
              imageEditWith({
                merge: [
                  { find: "SRC", replace: "https://media.example.com/x" },
                ],
              }),
              "editInvalid",
            ],
            [
              imageEditWith({
                fonts: [{ src: "https://fonts.example.com/synthetic.ttf" }],
              }),
              "editInvalid",
            ],
            [
              editOf({
                asset: {
                  options: { startSrc: "https://media.example.com/x.png" },
                  prompt: "A synthetic harbour",
                  type: "video",
                },
                length: 2,
                start: 0,
              }),
              "editInvalid",
            ],
            [
              imageEditWith({
                soundtrack: { src: "https://media.example.com/x.mp3" },
              }),
              "editInvalid",
            ],
            // Files that are not the workspace's, or not of the asset's kind.
            [
              editOf(imageClip(media("019a0000-0000-7000-8000-00000000dead"))),
              "mediaNotFound",
            ],
            [editOf(imageClip(media("not-a-media-id"))), "mediaNotFound"],
            [editOf(imageClip(media(voice))), "mediaNotSupported"],
            [
              editOf({
                asset: { src: media(first), type: "video" },
                length: 2,
                start: 0,
              }),
              "mediaNotSupported",
            ],
            [
              imageEditWith({ fonts: [{ src: media(first) }] }),
              "mediaNotSupported",
            ],
            // Outputs Peal does not render.
            [
              editOf(imageClip(media(first)), {
                format: "gif",
                resolution: "sd",
              }),
              "outputNotSupported",
            ],
            [
              editOf(imageClip(media(first)), { resolution: "4k" }),
              "outputNotSupported",
            ],
            [
              editOf(imageClip(media(first)), { aspectRatio: "4:5" }),
              "outputNotSupported",
            ],
            [
              editOf(imageClip(media(first)), {
                size: { height: 1080, width: 1080 },
              }),
              "outputNotSupported",
            ],
            [
              editOf(imageClip(media(first)), { fps: 60 }),
              "outputNotSupported",
            ],
            [
              editOf(imageClip(media(first)), { poster: { capture: 1 } }),
              "outputNotSupported",
            ],
            // Too large, too long.
            [
              {
                output: {},
                timeline: {
                  tracks: Array.from({ length: 21 }, () => ({
                    clips: [imageClip(media(first))],
                  })),
                },
              },
              "editTooLarge",
            ],
            [
              {
                output: {},
                timeline: {
                  tracks: [
                    {
                      clips: Array.from({ length: 201 }, (_, index) =>
                        imageClip(media(first), index)
                      ),
                    },
                  ],
                },
              },
              "editTooLarge",
            ],
            [editOf(imageClip(media(first), 299, 2)), "editTooLong"],
          ];

          for (const [edit, reason] of cases) {
            assert.strictEqual(yield* reasonOf(edit), reason);
          }

          const records = yield* SlideshowRecords;

          assert.lengthOf(yield* Ref.get(records.started), 0);
        }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
    );

    it.effect(
      "holds an edit to the same permissions, choice and payment as a slide video",
      () =>
        Effect.gen(function* rules() {
          const workspaceId = yield* freshWorkspace;

          const notSet = yield* requestingEdit(editorIn(workspaceId)).pipe(
            Effect.flip
          );

          assert.deepInclude(notSet, {
            _tag: "CompositionUnavailable",
            reason: "notSet",
          });

          yield* choosing(workspaceId);

          const viewer = yield* requestingEdit(
            actorIn(workspaceId, permissionsFor("viewer"))
          ).pipe(Effect.flip);

          assert.strictEqual(viewer._tag, "MissingPermission");
        }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
    );

    it.effect("refuses a billing account without a payment method", () =>
      Effect.gen(function* unpaid() {
        const workspaceId = yield* workspaceComposing();

        const refused = yield* requestingEdit(editorIn(workspaceId)).pipe(
          Effect.flip
        );

        assert.strictEqual(refused._tag, "CompositionNeedsPayment");
      }).pipe(
        Effect.provide(
          slideshowsTest({
            meters: fakeMeters({
              allowed: Option.none(),
              paymentMethod: false,
            }),
            script: editLibrary,
          })
        )
      )
    );

    it.effect("shares the workspace's turn with slide videos", () =>
      Effect.gen(function* busy() {
        const workspaceId = yield* workspaceComposing();
        const actor = editorIn(workspaceId);
        const queued = yield* requesting(actor);
        const refused = yield* requestingEdit(actor).pipe(Effect.flip);

        assert.deepInclude(refused, {
          _tag: "CompositionBusy",
          slideshowId: queued.id,
        });
      }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
    );

    it.effect("refuses a plan without room for the video", () =>
      Effect.gen(function* full() {
        const workspaceId = yield* workspaceComposing();

        const refused = yield* requestingEdit(editorIn(workspaceId)).pipe(
          Effect.flip
        );

        assert.strictEqual(refused._tag, "PlanLimitReached");
      }).pipe(
        Effect.provide(
          slideshowsTest({ script: { ...editLibrary, room: false } })
        )
      )
    );
  }
);

layer(DatabaseTest, { timeout: "60 seconds" })("an edit's job", (it) => {
  it.effect(
    "sends the edit once with a link for each file it names, and keeps the video",
    () =>
      Effect.gen(function* succeeds() {
        const workspaceId = yield* workspaceComposing();

        // The image named twice is linked once.
        const twice: Schema.JsonObject = {
          output: { aspectRatio: "9:16" },
          timeline: {
            tracks: [
              {
                clips: [
                  imageClip(media(first)),
                  imageClip(media(first), 2),
                  {
                    asset: { src: media(clipFile), type: "video" },
                    length: 3,
                    start: 4,
                  },
                ],
              },
            ],
          },
        };

        const slideshow = yield* requestingEdit(editorIn(workspaceId), twice);

        assert.strictEqual(yield* running(slideshow.id), "succeeded");

        const composer = yield* FakeComposer;
        const calls = yield* Ref.get(composer.asked);
        const records = yield* SlideshowRecords;

        assert.lengthOf(calls, 1);

        const sent = calls[0]?.request;

        assert.isTrue(sent !== undefined && "edit" in sent);
        assert.deepStrictEqual(
          sent !== undefined && "edit" in sent ? sent.edit["timeline"] : null,
          {
            tracks: [
              {
                clips: [
                  imageClip(`https://media.example.com/signed/${first}`),
                  imageClip(`https://media.example.com/signed/${first}`, 2),
                  {
                    asset: {
                      src: `https://media.example.com/signed/${clipFile}`,
                      type: "video",
                    },
                    length: 3,
                    start: 4,
                  },
                ],
              },
            ],
          }
        );
        assert.deepStrictEqual(
          (yield* Ref.get(records.linked)).map(([, seconds]) => seconds),
          [3600, 3600]
        );

        const ended = yield* AssistantSlideshows.use((slideshows) =>
          slideshows.view(editorIn(workspaceId), slideshow.id)
        );

        assert.strictEqual(ended.status, "succeeded");
        assert.isNull(yield* planOf(slideshow.id));
      }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
  );

  it.effect("fails a job whose file was deleted, sending nothing", () =>
    Effect.gen(function* gone() {
      const workspaceId = yield* workspaceComposing();
      const slideshow = yield* requestingEdit(editorIn(workspaceId));

      assert.strictEqual(yield* running(slideshow.id), "failed");

      const ended = yield* AssistantSlideshows.use((slideshows) =>
        slideshows.view(editorIn(workspaceId), slideshow.id)
      );

      const composer = yield* FakeComposer;

      assert.deepStrictEqual(ended.reason, Option.some("mediaUnavailable"));
      assert.lengthOf(yield* Ref.get(composer.asked), 0);
      assert.isNull(yield* planOf(slideshow.id));
    }).pipe(
      Effect.provide(
        slideshowsTest({ script: { ...editLibrary, links: false } })
      )
    )
  );

  it.effect("reads a slide plan as earlier releases stored it", () =>
    Effect.gen(function* earlier() {
      const workspaceId = yield* workspaceComposing();
      const slideshow = yield* requesting(editorIn(workspaceId));
      const sql = yield* SqlClient.SqlClient;

      // The row's plan as the release before wrote it, key for key.
      const written = JSON.stringify({
        secondsPerSlide: 4,
        slides: [
          { caption: "A synthetic harbour", mediaId: first, motion: "zoomIn" },
          { caption: null, mediaId: second, motion: "none" },
        ],
        transition: "fade",
      });

      yield* sql`UPDATE assistant.slideshows SET plan = ${written}::jsonb WHERE id = ${slideshow.id}`;

      assert.strictEqual(yield* running(slideshow.id), "succeeded");

      const composer = yield* FakeComposer;
      const sent = (yield* Ref.get(composer.asked))[0]?.request;

      assert.deepInclude(sent, { secondsPerSlide: 4, transition: "fade" });
    }).pipe(Effect.provide(slideshowsTest({ script: editLibrary })))
  );
});
