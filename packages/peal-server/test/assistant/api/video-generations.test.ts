import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, forWorkspace } from "peal-contract";
import type { Member } from "peal-contract";

import {
  AssistantApiLive,
  VideoGenerationsApiLive,
} from "#assistant/container.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  assistantTest,
  DatabaseTest,
  freshWorkspace,
} from "#test/assistant/support.ts";
import { memberOf } from "#test/channels/support.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The video endpoints and the models' video use, on their real use cases
// and Postgres, the synthetic keyring and the real outbound guard on a
// static resolver, the job recorded and never run (the job's own tests
// run it).

const syntheticKey = "sk_test_synthetic_video_key";

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["assistant", "media.videos"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.merge(AssistantApiLive, VideoGenerationsApiLive).pipe(
          Layer.provideMerge(securityTest(member))
        ),
        HttpServer.layerServices
      )
    )
  );

const as = (workspaceId: WorkspaceId, role: string) =>
  clientAs(memberOf(workspaceId, permissionsFor(role)));

const prompt = "A synthetic harbour at dawn.";

layer(DatabaseTest, { timeout: "60 seconds" })("the video endpoints", (it) => {
  it.effect(
    "make a video once a provider is chosen for videos, one at a time",
    () =>
      Effect.gen(function* makes() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const owner = yield* as(workspaceId, "owner");
        const editor = yield* as(workspaceId, "editor");

        // Off until a provider is chosen.
        const off = yield* editor["media.videos"]
          .create({ headers, payload: { aspect: "landscape", prompt } })
          .pipe(Effect.flip);

        assert.deepInclude(off, { _tag: "VideoUnavailable", reason: "notSet" });

        // OpenAI makes no videos here.
        yield* owner.assistant.connectProvider({
          headers,
          params: { provider: "openai" },
          payload: { apiKey: syntheticKey },
        });

        const notOffered = yield* owner.assistant
          .setModel({
            headers,
            params: { capability: "video" },
            payload: { model: "synthetic-video-model", provider: "openai" },
          })
          .pipe(Effect.flip);

        assert.strictEqual(notOffered._tag, "AiCapabilityNotOffered");

        yield* owner.assistant.connectProvider({
          headers,
          params: { provider: "xai" },
          payload: { apiKey: syntheticKey },
        });

        const chosen = yield* owner.assistant.setModel({
          headers,
          params: { capability: "video" },
          payload: { model: "grok-imagine-video", provider: "xai" },
        });

        assert.deepInclude(chosen, {
          capability: "video",
          provider: "xai",
          serverModel: false,
        });

        const status = yield* editor.assistant.status({ headers });

        assert.deepInclude(status.videos, {
          available: true,
          provider: "xai",
          remaining: 20,
        });

        const job = yield* editor["media.videos"].create({
          headers,
          payload: { aspect: "square", durationSeconds: 5, prompt },
        });

        assert.deepInclude(job, {
          aspect: "square",
          durationSeconds: 5,
          mediaId: null,
          reason: null,
          status: "queued",
        });
        // Never the prompt.
        assert.notInclude(JSON.stringify(job), prompt);

        const read = yield* editor["media.videos"].get({
          headers,
          params: { generationId: job.id },
        });

        const listed = yield* editor["media.videos"].list({
          headers,
          query: { status: "queued" },
        });

        assert.strictEqual(read.id, job.id);
        assert.deepStrictEqual(
          listed.generations.map(({ id }) => id),
          [job.id]
        );

        const busy = yield* editor["media.videos"]
          .create({ headers, payload: { aspect: "landscape", prompt } })
          .pipe(Effect.flip);

        assert.deepInclude(busy, { _tag: "VideoBusy", generationId: job.id });

        const tooLong = yield* editor["media.videos"]
          .create({
            headers,
            payload: { aspect: "landscape", durationSeconds: 30, prompt },
          })
          .pipe(Effect.flip);

        assert.deepInclude(tooLong, {
          _tag: "VideoRequestRejected",
          reason: "durationNotOffered",
        });

        const missing = yield* editor["media.videos"]
          .get({
            headers,
            params: {
              generationId: "019a0000-0000-7000-8000-00000000dead",
            },
          })
          .pipe(Effect.flip);

        assert.strictEqual(missing._tag, "VideoGenerationNotFound");
      }).pipe(Effect.provide(assistantTest()))
  );

  it.effect("refuse viewers, who may not use the assistant", () =>
    Effect.gen(function* viewers() {
      const workspaceId = yield* freshWorkspace;
      const headers = forWorkspace(workspaceId);
      const viewer = yield* as(workspaceId, "viewer");

      const refusals = yield* Effect.all([
        viewer["media.videos"]
          .create({ headers, payload: { aspect: "landscape", prompt } })
          .pipe(Effect.flip),
        viewer["media.videos"].list({ headers, query: {} }).pipe(Effect.flip),
      ]);

      assert.deepStrictEqual(
        refusals.map(({ _tag }) => _tag),
        ["Forbidden", "Forbidden"]
      );
    }).pipe(Effect.provide(assistantTest()))
  );
});
