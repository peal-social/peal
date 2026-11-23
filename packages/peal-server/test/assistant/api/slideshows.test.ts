import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api } from "peal-contract";
import type { Member } from "peal-contract";

import { AssistantApiLive, SlideshowsApiLive } from "#assistant/container.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { forgetSlideshowsOf } from "#test/assistant/slideshow-support.ts";
import {
  assistantTest,
  DatabaseTest,
  freshWorkspace,
} from "#test/assistant/support.ts";
import { memberOf } from "#test/channels/support.ts";
import { fakeMeters } from "#test/shared/fake-meters.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The slide video endpoints and the models' composition use, on their
// real use cases and Postgres, the synthetic keyring and the real outbound
// guard on a static resolver, the job recorded and never run (the job's
// own tests run it).

const syntheticKey = "synthetic-shotstack-key";

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["assistant", "slideshows"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.merge(AssistantApiLive, SlideshowsApiLive).pipe(
          Layer.provideMerge(securityTest(member))
        ),
        HttpServer.layerServices
      )
    )
  );

const as = (workspaceId: WorkspaceId, role: string) =>
  clientAs(memberOf(workspaceId, permissionsFor(role)));

const slides = [
  {
    caption: "A synthetic harbour",
    mediaId: "019a0000-0000-7000-8000-00000000c001",
  },
  { mediaId: "019a0000-0000-7000-8000-00000000c002" },
];

const sandbox = "https://api.shotstack.io/edit/stage";

// Connects Shotstack's sandbox and chooses it for slide videos.
const composing = (workspaceId: WorkspaceId) =>
  Effect.gen(function* connect() {
    const params = { workspaceId };
    const owner = yield* as(workspaceId, "owner");

    yield* owner.assistant.connectProvider({
      params: { ...params, provider: "shotstack" },
      payload: { apiKey: syntheticKey, baseUrl: sandbox },
    });

    return yield* owner.assistant.setModel({
      params: { ...params, capability: "composition" },
      payload: { provider: "shotstack" },
    });
  });

layer(DatabaseTest, { timeout: "60 seconds" })(
  "the slide video endpoints",
  (it) => {
    it.effect(
      "compose once Shotstack is connected and chosen, its sandbox or production alone",
      () =>
        Effect.gen(function* composes() {
          const workspaceId = yield* freshWorkspace;
          const params = { workspaceId };
          const owner = yield* as(workspaceId, "owner");
          const editor = yield* as(workspaceId, "editor");

          const off = yield* editor.slideshows
            .create({ params, payload: { aspect: "portrait", slides } })
            .pipe(Effect.flip);

          assert.deepInclude(off, {
            _tag: "CompositionUnavailable",
            reason: "notSet",
          });

          // Its production API or its sandbox, nowhere else.
          const proxy = yield* owner.assistant
            .connectProvider({
              params: { ...params, provider: "shotstack" },
              payload: {
                apiKey: syntheticKey,
                baseUrl: "https://proxy.example.com/edit/v1",
              },
            })
            .pipe(Effect.flip);

          assert.deepInclude(proxy, {
            _tag: "AiProviderAddressRefused",
            reason: "fixedAddress",
          });

          const chosen = yield* composing(workspaceId);

          // It takes no model: stored as the API it renders with.
          assert.deepInclude(chosen, {
            capability: "composition",
            model: "edit",
            provider: "shotstack",
            serverModel: false,
          });

          // Every other use needs one.
          const noModel = yield* owner.assistant
            .setModel({
              params: { ...params, capability: "text" },
              payload: { provider: "shotstack" },
            })
            .pipe(Effect.flip);

          assert.strictEqual(noModel._tag, "AiCapabilityNotOffered");

          const status = yield* editor.assistant.status({ params });

          assert.deepStrictEqual(status.slideshows, {
            available: true,
            dailyLimit: 20,
            paymentMethodRequired: false,
            provider: "shotstack",
            remaining: 20,
            sandbox: true,
          });

          // The test's library holds no image.
          const missing = yield* editor.slideshows
            .create({ params, payload: { aspect: "portrait", slides } })
            .pipe(Effect.flip);

          assert.deepInclude(missing, {
            _tag: "SlideshowRequestRejected",
            reason: "imageNotFound",
          });

          const listed = yield* editor.slideshows.list({ params, query: {} });

          assert.lengthOf(listed.slideshows, 0);

          const none = yield* editor.slideshows
            .get({
              params: {
                ...params,
                slideshowId: "019a0000-0000-7000-8000-00000000dead",
              },
            })
            .pipe(Effect.flip);

          assert.strictEqual(none._tag, "SlideshowNotFound");
        }).pipe(Effect.provide(assistantTest()))
    );

    it.effect("a model is required for a use that takes one", () =>
      Effect.gen(function* required() {
        const workspaceId = yield* freshWorkspace;
        const params = { workspaceId };
        const owner = yield* as(workspaceId, "owner");

        yield* owner.assistant.connectProvider({
          params: { ...params, provider: "openai" },
          payload: { apiKey: "sk_test_synthetic_openai_key" },
        });

        const refused = yield* owner.assistant
          .setModel({
            params: { ...params, capability: "image" },
            payload: { provider: "openai" },
          })
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "AiModelRequired");
      }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "refuse a billing account without a payment method, with its billing page",
      () =>
        Effect.gen(function* unpaid() {
          const workspaceId = yield* freshWorkspace;
          const params = { workspaceId };
          const editor = yield* as(workspaceId, "editor");

          yield* composing(workspaceId);

          const status = yield* editor.assistant.status({ params });

          assert.isTrue(status.slideshows.paymentMethodRequired);

          const refused = yield* editor.slideshows
            .create({ params, payload: { aspect: "portrait", slides } })
            .pipe(Effect.flip);

          assert.strictEqual(refused._tag, "CompositionNeedsPayment");
          assert.include(
            "billingUrl" in refused ? refused.billingUrl : "",
            `/${workspaceId}/billing`
          );
        }).pipe(
          Effect.provide(
            assistantTest({
              meters: fakeMeters({
                allowed: Option.none(),
                paymentMethod: false,
              }),
            })
          )
        )
    );

    it.effect(
      "render a whole edit: 202 with the job, 422 for an edit Peal does not render",
      () =>
        Effect.gen(function* edits() {
          const workspaceId = yield* freshWorkspace;
          const params = { workspaceId };
          const editor = yield* as(workspaceId, "editor");

          yield* forgetSlideshowsOf(workspaceId);

          // An image Shotstack generates names no file of the library.
          const edit = {
            output: { aspectRatio: "1:1" },
            timeline: {
              tracks: [
                {
                  clips: [
                    {
                      asset: { prompt: "A synthetic harbour", type: "image" },
                      length: 5,
                      start: 0,
                    },
                  ],
                },
              ],
            },
          };

          const off = yield* editor.slideshows
            .createFromEdit({ params, payload: { edit } })
            .pipe(Effect.flip);

          assert.deepInclude(off, {
            _tag: "CompositionUnavailable",
            reason: "notSet",
          });

          yield* composing(workspaceId);

          const refusals = yield* Effect.all(
            [
              { output: {}, timeline: { tracks: [] } },
              {
                ...edit,
                timeline: {
                  tracks: [
                    {
                      clips: [
                        {
                          asset: {
                            src: "peal:media/019a0000-0000-7000-8000-00000000c001",
                            type: "image",
                          },
                          length: 5,
                          start: 0,
                        },
                      ],
                    },
                  ],
                },
              },
              { ...edit, output: { format: "gif", resolution: "sd" } },
            ].map((each) =>
              editor.slideshows
                .createFromEdit({ params, payload: { edit: each } })
                .pipe(Effect.flip)
            )
          );

          assert.deepStrictEqual(
            refusals.map((refusal) =>
              "reason" in refusal ? [refusal._tag, refusal.reason] : []
            ),
            [
              ["SlideshowRequestRejected", "editInvalid"],
              ["SlideshowRequestRejected", "mediaNotFound"],
              ["SlideshowRequestRejected", "outputNotSupported"],
            ]
          );

          const queued = yield* editor.slideshows.createFromEdit({
            params,
            payload: { edit },
          });

          assert.deepInclude(queued, {
            aspect: "square",
            durationSeconds: 5,
            imageMediaIds: [],
            sandbox: true,
            status: "queued",
            voiceoverMediaId: null,
          });

          // One at a time a workspace.
          const busy = yield* editor.slideshows
            .createFromEdit({ params, payload: { edit } })
            .pipe(Effect.flip);

          assert.deepInclude(busy, {
            _tag: "CompositionBusy",
            slideshowId: queued.id,
          });

          const viewer = yield* as(workspaceId, "viewer");

          const forbidden = yield* viewer.slideshows
            .createFromEdit({ params, payload: { edit } })
            .pipe(Effect.flip);

          assert.strictEqual(forbidden._tag, "Forbidden");
        }).pipe(Effect.provide(assistantTest()))
    );

    it.effect("refuse viewers, who may not use the assistant", () =>
      Effect.gen(function* viewers() {
        const workspaceId = yield* freshWorkspace;
        const params = { workspaceId };
        const viewer = yield* as(workspaceId, "viewer");

        const refusals = yield* Effect.all([
          viewer.slideshows
            .create({ params, payload: { aspect: "portrait", slides } })
            .pipe(Effect.flip),
          viewer.slideshows.list({ params, query: {} }).pipe(Effect.flip),
        ]);

        assert.deepStrictEqual(
          refusals.map(({ _tag }) => _tag),
          ["Forbidden", "Forbidden"]
        );
      }).pipe(Effect.provide(assistantTest()))
    );
  }
);
