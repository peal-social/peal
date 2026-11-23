import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Option, Redacted } from "effect";

import {
  generateSpeechWith,
  transcribeWith,
} from "#assistant/infrastructure/ai-sdk/audio-model.ts";
import type { ProviderFetch } from "#assistant/infrastructure/ai-sdk/models.ts";
import { reasonOfAudioStatus } from "#assistant/infrastructure/own-audio-model.ts";

// Each speech and transcription provider's package as the registry builds
// it, on a fake fetch that answers as the provider would and keeps every
// request. Nothing here reaches a provider.

interface Sent {
  readonly body: string;
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
}

type Answer = (request: Sent) => Response;

// A fetch that answers with `answer` and keeps every request.
const fakeFetch = (answer: Answer) => {
  const sent: Sent[] = [];

  const fetch: ProviderFetch = Object.assign(
    async (input: Request | URL | string, init?: RequestInit) => {
      const request =
        input instanceof Request
          ? new Request(input, init)
          : new Request(input instanceof URL ? input.href : input, init);

      const kept: Sent = {
        body: request.method === "GET" ? "" : await request.text(),
        headers: request.headers,
        method: request.method,
        url: request.url,
      };

      sent.push(kept);

      return answer(kept);
    },
    { preconnect: globalThis.fetch.preconnect }
  );

  return { fetch, sent };
};

// Bytes that start as an MP3 does: an ID3 tag.
const mp3Bytes = Uint8Array.from({ length: 512 }, (_, index) => {
  const head = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0];

  return head[index] ?? index % 251;
});

const audio = () =>
  new Response(mp3Bytes, { headers: { "content-type": "audio/mpeg" } });

const key = Redacted.make("sk_test_synthetic_audio_key");

const speak = { text: "A synthetic voice-over.", voice: Option.some("alloy") };

describe("the AI SDK's speech adapter", () => {
  it.effect(
    "asks OpenAI once at its address, with the key, the voice and the model",
    () =>
      Effect.gen(function* openAiSpeech() {
        const { fetch, sent } = fakeFetch(audio);

        const spoken = yield* generateSpeechWith(
          {
            apiKey: key,
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4o-mini-tts",
            provider: "openai",
          },
          fetch,
          speak
        );

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(
          sent[0]?.url,
          "https://api.openai.com/v1/audio/speech"
        );
        assert.strictEqual(
          sent[0]?.headers.get("authorization"),
          "Bearer sk_test_synthetic_audio_key"
        );
        assert.include(sent[0]?.body, '"voice":"alloy"');
        assert.include(sent[0]?.body, '"model":"gpt-4o-mini-tts"');
        assert.strictEqual(sent[0]?.headers.get("traceparent"), null);
        assert.deepStrictEqual(spoken.bytes, mp3Bytes);
        assert.strictEqual(spoken.mediaType, "audio/mpeg");
      })
  );

  it.effect(
    "asks ElevenLabs at its own address, the key as `xi-api-key`, the voice in the path",
    () =>
      Effect.gen(function* elevenLabsSpeech() {
        const { fetch, sent } = fakeFetch(audio);

        yield* generateSpeechWith(
          {
            apiKey: key,
            baseUrl: "https://api.elevenlabs.io",
            model: "eleven_multilingual_v2",
            provider: "elevenlabs",
          },
          fetch,
          { text: "A synthetic voice-over.", voice: Option.some("synthetic") }
        );

        assert.strictEqual(sent.length, 1);
        assert.isTrue(
          sent[0]?.url.startsWith(
            "https://api.elevenlabs.io/v1/text-to-speech/synthetic"
          )
        );
        assert.strictEqual(
          sent[0]?.headers.get("xi-api-key"),
          "sk_test_synthetic_audio_key"
        );
      })
  );

  it.effect("asks xAI's speech API, which takes no model", () =>
    Effect.gen(function* xaiSpeech() {
      const { fetch, sent } = fakeFetch(audio);

      yield* generateSpeechWith(
        {
          apiKey: key,
          baseUrl: "https://api.x.ai/v1",
          model: "default",
          provider: "xai",
        },
        fetch,
        { text: "A synthetic voice-over.", voice: Option.none() }
      );

      assert.strictEqual(sent[0]?.url, "https://api.x.ai/v1/tts");
    })
  );

  it.effect("never reads a key from the environment", () =>
    Effect.gen(function* environmentKey() {
      const before = process.env["OPENAI_API_KEY"];
      process.env["OPENAI_API_KEY"] = "sk_test_synthetic_environment_key";

      const { fetch, sent } = fakeFetch(audio);

      yield* generateSpeechWith(
        {
          apiKey: key,
          baseUrl: "https://speech.example.com/v1",
          model: "tts-1",
          provider: "openai",
        },
        fetch,
        speak
      ).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            if (before === undefined) {
              delete process.env["OPENAI_API_KEY"];
            } else {
              process.env["OPENAI_API_KEY"] = before;
            }
          })
        )
      );

      assert.strictEqual(
        sent[0]?.url,
        "https://speech.example.com/v1/audio/speech"
      );
      assert.strictEqual(
        sent[0]?.headers.get("authorization"),
        "Bearer sk_test_synthetic_audio_key"
      );
    })
  );

  it.effect("sends a failed request once, and fails by its status alone", () =>
    Effect.gen(function* serverError() {
      const { fetch, sent } = fakeFetch(() =>
        Response.json({ error: { message: "synthetic" } }, { status: 500 })
      );

      const failure = yield* generateSpeechWith(
        {
          apiKey: key,
          baseUrl: "https://api.openai.com/v1",
          model: "tts-1",
          provider: "openai",
        },
        fetch,
        speak
      ).pipe(Effect.flip);

      assert.strictEqual(sent.length, 1);
      assert.strictEqual(failure.kind, "status");
      assert.strictEqual(failure.status, 500);
    })
  );

  it.effect("fails as unsent when the fetch throws", () =>
    Effect.gen(function* thrown() {
      const fetch: ProviderFetch = Object.assign(
        async () => {
          await Promise.resolve();

          throw new TypeError("fetch refused for synthetic");
        },
        { preconnect: globalThis.fetch.preconnect }
      );

      const failure = yield* generateSpeechWith(
        {
          apiKey: key,
          baseUrl: "https://api.openai.com/v1",
          model: "tts-1",
          provider: "openai",
        },
        fetch,
        speak
      ).pipe(Effect.flip);

      assert.strictEqual(failure.kind, "unsent");
    })
  );
});

describe("the AI SDK's transcription adapter", () => {
  it.effect("sends OpenAI the file once, and reads its text", () =>
    Effect.gen(function* openAiTranscript() {
      const { fetch, sent } = fakeFetch(() =>
        Response.json({ duration: 3, language: "en", text: "Synthetic." })
      );

      const transcript = yield* transcribeWith(
        {
          apiKey: key,
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-transcribe",
          provider: "openai",
        },
        fetch,
        mp3Bytes
      );

      assert.strictEqual(sent.length, 1);
      assert.strictEqual(
        sent[0]?.url,
        "https://api.openai.com/v1/audio/transcriptions"
      );
      assert.strictEqual(transcript.text, "Synthetic.");
    })
  );

  it.effect("sends Groq the file at its address", () =>
    Effect.gen(function* groqTranscript() {
      const { fetch, sent } = fakeFetch(() =>
        Response.json({ text: "Synthetic.", x_groq: { id: "synthetic" } })
      );

      const transcript = yield* transcribeWith(
        {
          apiKey: key,
          baseUrl: "https://api.groq.com/openai/v1",
          model: "whisper-large-v3-turbo",
          provider: "groq",
        },
        fetch,
        mp3Bytes
      );

      assert.strictEqual(
        sent[0]?.url,
        "https://api.groq.com/openai/v1/audio/transcriptions"
      );
      assert.strictEqual(transcript.text, "Synthetic.");
    })
  );

  it.effect("sends ElevenLabs the file at its own address", () =>
    Effect.gen(function* elevenLabsTranscript() {
      const { fetch, sent } = fakeFetch(() =>
        Response.json({
          audio_duration_secs: 3,
          language_code: "en",
          language_probability: 1,
          text: "Synthetic.",
          words: [],
        })
      );

      const transcript = yield* transcribeWith(
        {
          apiKey: key,
          baseUrl: "https://api.elevenlabs.io",
          model: "scribe_v2",
          provider: "elevenlabs",
        },
        fetch,
        mp3Bytes
      );

      assert.strictEqual(
        sent[0]?.url,
        "https://api.elevenlabs.io/v1/speech-to-text"
      );
      assert.strictEqual(transcript.text, "Synthetic.");
      assert.deepStrictEqual(transcript.language, Option.some("en"));
    })
  );

  it.effect("fails an answer without a transcript as unusable", () =>
    Effect.gen(function* unusable() {
      const { fetch } = fakeFetch(() => Response.json({ nothing: true }));

      const failure = yield* transcribeWith(
        {
          apiKey: key,
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-transcribe",
          provider: "openai",
        },
        fetch,
        mp3Bytes
      ).pipe(Effect.flip);

      assert.strictEqual(failure.kind, "unusable");
    })
  );
});

describe("an audio provider's status, as a reason", () => {
  it("reads settings, redirects, busy and refusals", () => {
    expect(
      [401, 404, 302, 429, 503, 400].map(reasonOfAudioStatus)
    ).toStrictEqual([
      "settingsRefused",
      "settingsRefused",
      "redirected",
      "unreachable",
      "unreachable",
      "refused",
    ]);
  });
});
