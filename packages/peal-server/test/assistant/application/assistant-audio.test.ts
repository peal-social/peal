import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted, Ref } from "effect";

import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import type { ConnectedProviderId } from "#assistant/domain/ai-capability.ts";
import { connectionAddresses } from "#assistant/domain/ai-capability.ts";
import {
  transcriptionsPerDay,
  voiceoversPerDay,
} from "#assistant/domain/audio-limits.ts";
import type { AudioCapability } from "#assistant/domain/audio-use.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import { Actor } from "#shared/domain/access.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  AudioRecords,
  audioPortsTest,
  storedAudioId,
  syntheticVoiceover,
} from "#test/assistant/audio-support.ts";
import type { AudioScript } from "#test/assistant/audio-support.ts";
import {
  actorIn,
  DatabaseTest,
  freshWorkspace,
  ImageProvidersTest,
} from "#test/assistant/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The voice-over and transcript use cases on the real counts and stores
// in Postgres, the workspace's providers sealed as the server keeps them,
// a scripted library and a scripted provider, which no request leaves.

const audioTest = (script: AudioScript = {}) =>
  AssistantAudio.layer.pipe(
    Layer.provideMerge(audioPortsTest(script)),
    Layer.provideMerge(ImageProvidersTest)
  );

const editorIn = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, permissionsFor("editor"));

// A workspace that chose `provider` and `model` for `capability`.
const choosing = (
  workspaceId: WorkspaceId,
  capability: AudioCapability,
  provider: ConnectedProviderId,
  model: string
) =>
  Effect.gen(function* choose() {
    const now = yield* DateTime.now;

    yield* ProviderConnections.use((connections) =>
      connections.save(
        workspaceId,
        new ProviderConnectionSettings({
          baseUrl: ProviderAddressSchema.make(
            connectionAddresses[provider] ?? "https://ai.example.com/v1"
          ),
          provider,
          updatedAt: now,
        }),
        Redacted.make("sk_test_synthetic_audio_key")
      )
    ).pipe(Effect.orDie);

    yield* CapabilityModels.use((models) =>
      models.set(
        workspaceId,
        new CapabilityModelSettings({
          capability,
          model: ProviderModelSchema.make(model),
          provider,
          updatedAt: now,
        })
      )
    );
  });

const voiceover = (actor: Actor, voice: string | null = "alloy") =>
  AssistantAudio.use((audio) =>
    audio.voiceover(actor, { text: "A synthetic voice-over.", voice })
  );

const transcribing = (actor: Actor, mediaId: string, save = false) =>
  AssistantAudio.use((audio) =>
    audio.transcribe(actor, mediaId, { saveAsDescription: save })
  );

const recordingBytes = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 1, 2, 3]);

const recordingId = "019a0000-0000-7000-8000-00000000a0d2";

layer(DatabaseTest, { timeout: "60 seconds" })("a voice-over", (it) => {
  it.effect(
    "is spoken by the chosen provider with its key, and kept in the library",
    () =>
      Effect.gen(function* spoken() {
        const workspaceId = yield* freshWorkspace;

        yield* choosing(workspaceId, "speech", "openai", "gpt-4o-mini-tts");

        const audio = yield* voiceover(editorIn(workspaceId));
        const records = yield* AudioRecords;
        const spokenTo = yield* Ref.get(records.spoken);

        assert.strictEqual(audio.id, storedAudioId);
        assert.strictEqual(audio.kind, "audio");
        assert.strictEqual(spokenTo.length, 1);
        assert.strictEqual(spokenTo[0]?.endpoint.provider, "openai");
        assert.strictEqual(spokenTo[0]?.endpoint.model, "gpt-4o-mini-tts");
        assert.strictEqual(
          spokenTo[0]?.endpoint.baseUrl,
          "https://api.openai.com/v1"
        );
        assert.deepStrictEqual(spokenTo[0]?.voice, Option.some("alloy"));
        assert.deepStrictEqual(yield* Ref.get(records.stored), [
          syntheticVoiceover,
        ]);
      }).pipe(Effect.provide(audioTest()))
  );

  it.effect("is unavailable until a provider is chosen for speech", () =>
    Effect.gen(function* unavailable() {
      const workspaceId = yield* freshWorkspace;

      const failure = yield* voiceover(editorIn(workspaceId)).pipe(Effect.flip);

      assert.strictEqual(failure._tag, "AudioUnavailable");
    }).pipe(Effect.provide(audioTest()))
  );

  it.effect(
    "refuses a blank text, and a voice for a provider that takes none",
    () =>
      Effect.gen(function* refusals() {
        const workspaceId = yield* freshWorkspace;

        yield* choosing(
          workspaceId,
          "speech",
          "fal",
          "fal-ai/minimax/speech-02-hd"
        );

        const blank = yield* AssistantAudio.use((audio) =>
          audio.voiceover(editorIn(workspaceId), { text: "  ", voice: null })
        ).pipe(Effect.flip);

        const voiced = yield* voiceover(editorIn(workspaceId), "alloy").pipe(
          Effect.flip
        );

        assert.strictEqual(blank._tag, "DraftRejected");
        assert.strictEqual(voiced._tag, "VoiceNotOffered");
        assert.strictEqual(
          (yield* Ref.get((yield* AudioRecords).spoken)).length,
          0
        );
      }).pipe(Effect.provide(audioTest()))
  );

  it.effect("asks nothing when the plan has no room for it", () =>
    Effect.gen(function* full() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "speech", "openai", "tts-1");

      const failure = yield* voiceover(editorIn(workspaceId)).pipe(Effect.flip);

      assert.strictEqual(failure._tag, "PlanLimitReached");
      assert.strictEqual(
        (yield* Ref.get((yield* AudioRecords).spoken)).length,
        0
      );
    }).pipe(Effect.provide(audioTest({ room: false })))
  );

  it.effect("counts a request the provider refused, and says why", () =>
    Effect.gen(function* refused() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "speech", "openai", "tts-1");

      const failure = yield* voiceover(editorIn(workspaceId)).pipe(Effect.flip);

      const status = yield* AssistantAudio.use((audio) =>
        audio.voiceoversStatus(editorIn(workspaceId))
      );

      assert.strictEqual(failure._tag, "AudioFailed");
      assert.strictEqual(status.remaining, voiceoversPerDay - 1);
      assert.strictEqual(status.provider, "openai");
      assert.isTrue(status.available);
    }).pipe(Effect.provide(audioTest({ fails: "settingsRefused" })))
  );

  it.effect("stops at the day's allowance", () =>
    Effect.gen(function* allowance() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "speech", "openai", "tts-1");

      yield* Effect.repeat(voiceover(editorIn(workspaceId)), {
        times: voiceoversPerDay - 1,
      });

      const failure = yield* voiceover(editorIn(workspaceId)).pipe(Effect.flip);

      assert.strictEqual(failure._tag, "AudioExhausted");
    }).pipe(Effect.provide(audioTest()))
  );

  it.effect("needs media:upload, and refuses staff acting as a member", () =>
    Effect.gen(function* permissions() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "speech", "openai", "tts-1");

      const viewer = yield* voiceover(
        actorIn(workspaceId, permissionsFor("viewer"))
      ).pipe(Effect.flip);

      const staff = yield* voiceover(
        new Actor({
          permissions: permissionsFor("owner"),
          subject: {
            _tag: "user",
            impersonatedBy: Option.some(
              UserIdSchema.make("6c2d6f8e-4e3b-4d2c-8f1e-8b7c6d5e4f3a")
            ),
            userId: UserIdSchema.make("5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"),
          },
          workspaceId,
        })
      ).pipe(Effect.flip);

      assert.strictEqual(viewer._tag, "MissingPermission");
      assert.strictEqual(staff._tag, "MissingPermission");
    }).pipe(Effect.provide(audioTest()))
  );
});

layer(DatabaseTest, { timeout: "60 seconds" })("a transcript", (it) => {
  const files = new Map<string, Uint8Array | "notAudio">([
    [recordingId, recordingBytes],
    ["019a0000-0000-7000-8000-00000000a0d3", "notAudio"],
  ]);

  it.effect("sends the file to the chosen provider and answers its text", () =>
    Effect.gen(function* transcribed() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "transcription", "groq", "whisper-large-v3");

      const transcript = yield* transcribing(
        editorIn(workspaceId),
        recordingId
      );

      const records = yield* AudioRecords;
      const sent = yield* Ref.get(records.transcribed);

      assert.strictEqual(transcript.text, "A synthetic transcript.");
      assert.strictEqual(transcript.language, "en");
      assert.isFalse(transcript.descriptionSaved);
      assert.deepStrictEqual(sent[0]?.audio, recordingBytes);
      assert.strictEqual(sent[0]?.endpoint.provider, "groq");
      assert.deepStrictEqual(yield* Ref.get(records.described), []);
    }).pipe(Effect.provide(audioTest({ files })))
  );

  it.effect("saves it as the file's description when asked", () =>
    Effect.gen(function* described() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "transcription", "openai", "whisper-1");

      const transcript = yield* transcribing(
        editorIn(workspaceId),
        recordingId,
        true
      );

      assert.isTrue(transcript.descriptionSaved);
      assert.deepStrictEqual(yield* Ref.get((yield* AudioRecords).described), [
        [recordingId, "A synthetic transcript."],
      ]);
    }).pipe(Effect.provide(audioTest({ files })))
  );

  it.effect(
    "refuses a file that is no audio, and one not found, counting nothing",
    () =>
      Effect.gen(function* refused() {
        const workspaceId = yield* freshWorkspace;

        yield* choosing(workspaceId, "transcription", "openai", "whisper-1");

        const notAudio = yield* transcribing(
          editorIn(workspaceId),
          "019a0000-0000-7000-8000-00000000a0d3"
        ).pipe(Effect.flip);

        const missing = yield* transcribing(
          editorIn(workspaceId),
          "019a0000-0000-7000-8000-00000000a0d9"
        ).pipe(Effect.flip);

        const status = yield* AssistantAudio.use((audio) =>
          audio.transcriptionsStatus(editorIn(workspaceId))
        );

        assert.strictEqual(notAudio._tag, "AudioNotTranscribable");
        assert.strictEqual(missing._tag, "AudioMediaNotFound");
        assert.strictEqual(status.remaining, transcriptionsPerDay);
      }).pipe(Effect.provide(audioTest({ files })))
  );

  it.effect("is unavailable for a provider that transcribes nothing", () =>
    Effect.gen(function* notOffered() {
      const workspaceId = yield* freshWorkspace;

      yield* choosing(workspaceId, "speech", "openai", "tts-1");

      const failure = yield* transcribing(
        editorIn(workspaceId),
        recordingId
      ).pipe(Effect.flip);

      assert.strictEqual(failure._tag, "AudioUnavailable");
    }).pipe(Effect.provide(audioTest({ files })))
  );
});
