import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";

import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { Dns } from "effect/net";

import { OwnAudioModel } from "#assistant/application/ports/own-audio-model.ts";
import { VoiceoverTextSchema } from "#assistant/domain/audio-use.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import { ownAudioModel } from "#assistant/infrastructure/own-audio-model.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

// OwnAudioModel on a loopback provider that answers as OpenAI's speech
// and transcription APIs would, through a guard that lets loopback
// through; one test keeps the real guard, which refuses it. Nothing here
// calls a real provider.

const syntheticKey = "sk_test_synthetic_audio_key";

const text = VoiceoverTextSchema.make("A synthetic voice-over.");

const mp3Bytes = Uint8Array.from(
  { length: 1024 },
  (_, index) => [0x49, 0x44, 0x33, 4, 0][index] ?? index % 251
);

type Answer = (response: ServerResponse) => void;

interface Received {
  readonly headers: IncomingHttpHeaders;
  readonly url: string;
}

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

// The answer for a path: found by comparing each path the test gave, so
// a request's path never names what is called.
const answerFor = (
  answers: Readonly<Record<string, Answer>>,
  path: string
): Answer | undefined =>
  Object.entries(answers).find(([known]) => known === path)?.[1];

// A provider answering each path as `answers` says, recording what it was
// sent; closed with the scope.
const provider = (answers: Readonly<Record<string, Answer>>) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const received: Received[] = [];

      const server = createServer((request, response) => {
        request.resume();
        request.on("end", () => {
          received.push({ headers: request.headers, url: request.url ?? "" });

          const answer = answerFor(answers, request.url ?? "");

          if (answer === undefined) {
            response.writeHead(418).end();
          } else {
            answer(response);
          }
        });
      });

      server.listen(0, "127.0.0.1");
      await once(server, "listening");

      const origin = `http://127.0.0.1:${decodeAddress(server.address()).port}`;

      return { received, server, url: `${origin}/v1` };
    }),
    ({ server }) =>
      Effect.promise(async () => {
        server.closeAllConnections();
        server.close();
        await once(server, "close");
      })
  );

const modelWith = (guard: Layer.Layer<OutboundGuard> = OpenOutboundGuard) =>
  ownAudioModel().pipe(Layer.provide(guard));

const speechAt = (baseUrl: string) => ({
  apiKey: Redacted.make(syntheticKey),
  baseUrl: ProviderAddressSchema.make(baseUrl),
  model: "gpt-4o-mini-tts",
  provider: "openai" as const,
});

describe("a workspace's own audio provider", () => {
  it.live("speaks once, with the key, and answers the audio", () =>
    Effect.gen(function* speaks() {
      const { received, url } = yield* provider({
        "/v1/audio/speech": (response) => {
          response
            .writeHead(200, { "content-type": "audio/mpeg" })
            .end(mp3Bytes);
        },
      });

      const spoken = yield* OwnAudioModel.use((model) =>
        model.speak(speechAt(url), { text, voice: Option.some("alloy") })
      ).pipe(Effect.provide(modelWith()));

      assert.deepStrictEqual(spoken.bytes, mp3Bytes);
      assert.strictEqual(received.length, 1);
      assert.strictEqual(
        received[0]?.headers.authorization,
        `Bearer ${syntheticKey}`
      );
      assert.isUndefined(received[0]?.headers["traceparent"]);
    }).pipe(Effect.scoped)
  );

  it.live("says why a provider refused, by its status alone", () =>
    Effect.gen(function* refused() {
      const { received, url } = yield* provider({
        "/v1/audio/speech": (response) => {
          response.writeHead(401).end();
        },
        "/v1/audio/transcriptions": (response) => {
          response.writeHead(503).end();
        },
      });

      const speech = yield* OwnAudioModel.use((model) =>
        model.speak(speechAt(url), { text, voice: Option.none() })
      ).pipe(Effect.provide(modelWith()), Effect.flip);

      const transcript = yield* OwnAudioModel.use((model) =>
        model.transcribe(
          { ...speechAt(url), model: "whisper-1", provider: "openai" },
          mp3Bytes
        )
      ).pipe(Effect.provide(modelWith()), Effect.flip);

      assert.deepInclude(speech, {
        capability: "speech",
        reason: "settingsRefused",
      });
      assert.deepInclude(transcript, {
        capability: "transcription",
        reason: "unreachable",
      });
      // Never sent again.
      assert.strictEqual(received.length, 2);
    }).pipe(Effect.scoped)
  );

  it.live("sends nothing to an address the guard refuses", () =>
    Effect.gen(function* guarded() {
      const realGuard = OutboundGuard.layer.pipe(
        Layer.provide(Dns.layerStatic({ hosts: {} })),
        Layer.orDie
      );

      const { received, url } = yield* provider({});

      const failure = yield* OwnAudioModel.use((model) =>
        model.speak(speechAt(url), { text, voice: Option.none() })
      ).pipe(Effect.provide(modelWith(realGuard)), Effect.flip);

      assert.deepInclude(failure, { reason: "addressRefused" });
      assert.strictEqual(received.length, 0);
    }).pipe(Effect.scoped)
  );
});
