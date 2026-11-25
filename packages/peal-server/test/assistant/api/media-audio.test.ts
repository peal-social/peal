import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import {
  Api,
  Authentication,
  CurrentPrincipal,
  forWorkspace,
} from "peal-contract";
import type { Member } from "peal-contract";

import { MediaTranscriptionsHandlers } from "#assistant/api/transcriptions.ts";
import { AssistantApiLive, MediaAudioApiLive } from "#assistant/container.ts";
import { ChangeMark, makeChangeMark } from "#shared/api/change-mark.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { storedAudioId } from "#test/assistant/audio-support.ts";
import {
  assistantTest,
  DatabaseTest,
  freshWorkspace,
} from "#test/assistant/support.ts";
import { memberOf } from "#test/channels/support.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The voice-over and transcript endpoints and the models' audio uses, on
// their real use cases and Postgres, the synthetic keyring and the real
// outbound guard on a static resolver; the providers and the library
// scripted, so no request leaves.

const syntheticKey = "sk_test_synthetic_audio_key";

// Each request acts as the member, its handler saying through `mark` what
// it changed, as Authentication provides it.
const markedSecurity = (member: Member, mark: ChangeMark["Service"]) => {
  const marked = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(CurrentPrincipal, member.principal),
      Effect.provideService(ChangeMark, mark)
    );

  return Layer.succeed(
    Authentication,
    Authentication.of({ bearer: marked, session: marked })
  );
};

const clientAs = (
  member: Member,
  mark: Layer.Layer<Authentication> | Layer.Layer<never> = Layer.empty
) =>
  HttpApiTest.groups(Api, [
    "assistant",
    "media.voiceovers",
    "media.transcriptions",
  ]).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.mergeAll(
          AssistantApiLive,
          MediaAudioApiLive,
          MediaTranscriptionsHandlers
        ).pipe(Layer.provideMerge(Layer.mergeAll(securityTest(member), mark))),
        HttpServer.layerServices
      )
    )
  );

const as = (workspaceId: WorkspaceId, role: string) =>
  clientAs(memberOf(workspaceId, permissionsFor(role)));

const recordingId = "019a0000-0000-7000-8000-00000000a0d2";

const files = new Map<string, Uint8Array | "tooLarge">([
  [recordingId, new Uint8Array([0x49, 0x44, 0x33, 4, 0])],
  ["019a0000-0000-7000-8000-00000000a0d4", "tooLarge"],
]);

layer(DatabaseTest, { timeout: "60 seconds" })(
  "the voice-over and transcript endpoints",
  (it) => {
    it.effect("make a voice-over once a provider is chosen for speech", () =>
      Effect.gen(function* voiceover() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const owner = yield* as(workspaceId, "owner");
        const editor = yield* as(workspaceId, "editor");
        const payload = { text: "A synthetic voice-over.", voice: "Rachel" };

        const off = yield* editor["media.voiceovers"]
          .create({ headers, payload })
          .pipe(Effect.flip);

        assert.deepInclude(off, {
          _tag: "AudioUnavailable",
          capability: "speech",
          reason: "notSet",
        });

        // ElevenLabs is reached at its own address alone.
        const proxied = yield* owner.assistant
          .connectProvider({
            headers,
            params: { provider: "elevenlabs" },
            payload: {
              apiKey: syntheticKey,
              baseUrl: "https://proxy.example.com",
            },
          })
          .pipe(Effect.flip);

        assert.deepInclude(proxied, {
          _tag: "AiProviderAddressRefused",
          reason: "fixedAddress",
        });

        yield* owner.assistant.connectProvider({
          headers,
          params: { provider: "elevenlabs" },
          payload: { apiKey: syntheticKey },
        });

        // It writes no text: neither a text model nor a test.
        const noText = yield* owner.assistant
          .setModel({
            headers,
            params: { capability: "text" },
            payload: { model: "synthetic", provider: "elevenlabs" },
          })
          .pipe(Effect.flip);

        const noTest = yield* owner.assistant
          .testProvider({
            headers,
            params: { provider: "elevenlabs" },
            payload: {},
          })
          .pipe(Effect.flip);

        // Nor through the deprecated text provider endpoint.
        const noTextProvider = yield* owner.assistant
          .setTextProvider({
            headers,
            payload: {
              apiKey: syntheticKey,
              model: "synthetic",
              provider: "elevenlabs",
            },
          })
          .pipe(Effect.flip);

        assert.strictEqual(noText._tag, "AiCapabilityNotOffered");
        assert.strictEqual(noTest._tag, "AiCapabilityNotOffered");
        assert.strictEqual(noTextProvider._tag, "AiCapabilityNotOffered");

        yield* owner.assistant.setModel({
          headers,
          params: { capability: "speech" },
          payload: { model: "eleven_multilingual_v2", provider: "elevenlabs" },
        });

        const status = yield* editor.assistant.status({ headers });

        assert.deepInclude(status.voiceovers, {
          available: true,
          maxTextLength: 4000,
          provider: "elevenlabs",
          remaining: 50,
        });
        assert.deepInclude(status.transcriptions, {
          available: false,
          provider: null,
        });

        const made = yield* editor["media.voiceovers"].create({
          headers,
          payload,
        });

        assert.deepInclude(made, {
          aiGenerated: true,
          id: storedAudioId,
          kind: "audio",
        });

        const blank = yield* editor["media.voiceovers"]
          .create({ headers, payload: { text: " " } })
          .pipe(Effect.flip);

        assert.deepInclude(blank, {
          _tag: "AssistantInputRejected",
          reason: "empty",
        });
      }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "transcribe a file of the library once a provider is chosen",
      () =>
        Effect.gen(function* transcript() {
          const workspaceId = yield* freshWorkspace;
          const headers = forWorkspace(workspaceId);
          const owner = yield* as(workspaceId, "owner");
          const editor = yield* as(workspaceId, "editor");
          const savedMark = yield* makeChangeMark;
          const readMark = yield* makeChangeMark;

          // An editor whose requests each tell `mark` what they changed.
          const marking = (mark: ChangeMark["Service"]) => {
            const member = memberOf(workspaceId, permissionsFor("editor"));

            return clientAs(member, markedSecurity(member, mark));
          };

          yield* owner.assistant.connectProvider({
            headers,
            params: { provider: "groq" },
            payload: { apiKey: syntheticKey },
          });
          yield* owner.assistant.setModel({
            headers,
            params: { capability: "transcription" },
            payload: { model: "whisper-large-v3-turbo", provider: "groq" },
          });

          const answered = yield* (yield* marking(savedMark))[
            "media.transcriptions"
          ].create({
            headers,
            params: { mediaId: recordingId },
            payload: { saveAsDescription: true },
          });

          assert.deepStrictEqual(answered, {
            descriptionSaved: true,
            durationSeconds: 3,
            language: "en",
            text: "A synthetic transcript.",
          });

          // Read only, the transcript changes no content, which the
          // connection journal hears; saved, it changed the description.
          const read = yield* (yield* marking(readMark))[
            "media.transcriptions"
          ].create({
            headers,
            params: { mediaId: recordingId },
            payload: {},
          });

          assert.isFalse(read.descriptionSaved);
          assert.isFalse(yield* savedMark.changedNoContent);
          assert.isTrue(yield* readMark.changedNoContent);
          assert.isFalse(yield* readMark.changedNothing);

          const tooLarge = yield* editor["media.transcriptions"]
            .create({
              headers,
              params: {
                mediaId: "019a0000-0000-7000-8000-00000000a0d4",
              },
              payload: {},
            })
            .pipe(Effect.flip);

          const missing = yield* editor["media.transcriptions"]
            .create({
              headers,
              params: { mediaId: "not-an-id" },
              payload: {},
            })
            .pipe(Effect.flip);

          assert.deepInclude(tooLarge, {
            _tag: "TranscriptionRejected",
            maxBytes: 25_000_000,
            reason: "tooLarge",
          });
          assert.strictEqual(missing._tag, "MediaNotFound");
        }).pipe(Effect.provide(assistantTest({ audio: { files } })))
    );

    it.effect("refuse viewers, who may not use the assistant", () =>
      Effect.gen(function* viewers() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const viewer = yield* as(workspaceId, "viewer");

        const refusals = yield* Effect.all([
          viewer["media.voiceovers"]
            .create({ headers, payload: { text: "Synthetic." } })
            .pipe(Effect.flip),
          viewer["media.transcriptions"]
            .create({
              headers,
              params: { mediaId: recordingId },
              payload: {},
            })
            .pipe(Effect.flip),
        ]);

        assert.deepStrictEqual(
          refusals.map(({ _tag }) => _tag),
          ["Forbidden", "Forbidden"]
        );
      }).pipe(Effect.provide(assistantTest()))
    );
  }
);
