import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { generateImage, NoSuchModelError } from "ai";
import { Effect, Option, Redacted, Schema } from "effect";
import { Base64 } from "effect/encoding";

import type { ImageAspect } from "#assistant/domain/image-aspect.ts";
import { imageDimensionsOf } from "#assistant/domain/image-provider.ts";
import type { ImageProviderId } from "#assistant/domain/image-provider.ts";
import { generateImageWith } from "#assistant/infrastructure/ai-sdk/image-model.ts";
import { imageModelOf } from "#assistant/infrastructure/ai-sdk/models.ts";
import type { ImageModelSettings } from "#assistant/infrastructure/ai-sdk/models.ts";

// Each image provider's package as the registry builds it, on a fake
// fetch that keeps what it is sent: the address, the key's header and the
// body. Nothing here reaches a provider.

interface Sent {
  readonly body: { readonly [key: string]: Schema.Json };
  readonly headers: Readonly<Record<string, string>>;
  readonly url: string;
}

const decodeBody = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json))
);

// Bytes that start as a PNG does.
const pngBytes = Uint8Array.from(
  { length: 512 },
  (_, index) =>
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index] ?? index % 251
);

const imagesAnswer = {
  created: 1,
  data: [{ b64_json: Base64.encode(pngBytes) }],
};

// Gemini answers its images as the parts of a message.
const geminiAnswer = {
  candidates: [
    {
      content: {
        parts: [
          {
            inlineData: {
              data: Base64.encode(pngBytes),
              mimeType: "image/png",
            },
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: {
    candidatesTokenCount: 1290,
    promptTokenCount: 12,
    totalTokenCount: 1302,
  },
};

// A fetch that answers as the provider would, and keeps every request.
const fakeFetch = (status = 200) => {
  const sent: Sent[] = [];

  const fetch = Object.assign(
    async (input: Request | URL | string, init?: RequestInit) => {
      const request =
        input instanceof Request
          ? new Request(input, init)
          : new Request(input instanceof URL ? input.href : input, init);

      sent.push({
        body: decodeBody(await request.text()),
        headers: Object.fromEntries(request.headers.entries()),
        url: request.url,
      });

      return status === 200
        ? Response.json(
            request.url.includes(":generateContent")
              ? geminiAnswer
              : imagesAnswer
          )
        : Response.json(
            { error: { message: "synthetic refusal" } },
            { status }
          );
    },
    { preconnect: globalThis.fetch.preconnect }
  );

  return { fetch, sent };
};

const settingsFor = (
  provider: ImageProviderId,
  baseUrl: string,
  apiKey: Option.Option<string> = Option.some("sk_test_synthetic_key")
): ImageModelSettings => ({
  apiKey: apiKey.pipe(Option.map(Redacted.make)),
  baseUrl,
  model:
    provider === "google" ? "gemini-nano-banana-2.1" : "synthetic-image-model",
  provider,
});

// One image through the adapter, its API and download on the same fake.
const ask = (settings: ImageModelSettings, aspect: ImageAspect = "landscape") =>
  Effect.gen(function* asked() {
    const { fetch, sent } = fakeFetch();

    const bytes = yield* generateImageWith(
      settings,
      { api: fetch, download: fetch },
      {
        prompt: "A synthetic lighthouse.",
        dimensions: imageDimensionsOf(settings.provider, aspect),
      }
    );

    assert.deepStrictEqual(bytes, pngBytes);
    assert.lengthOf(sent, 1);

    const [request] = sent;

    // Peal's trace context stays with Peal.
    assert.isUndefined(request?.headers["traceparent"]);

    return request ?? { body: {}, headers: {}, url: "" };
  });

const fieldOf = (body: Sent["body"], key: string) =>
  Option.getOrNull(Option.fromUndefinedOr(body[key]));

// What the SDK's factories would read when Peal gave them nothing.
const outsideEnv = {
  GOOGLE_GENERATIVE_AI_API_KEY: "synthetic-env-google-key",
  OPENAI_API_KEY: "synthetic-env-openai-key",
  OPENAI_BASE_URL: "https://env.example.test/openai",
  TOGETHER_API_KEY: "synthetic-env-together-key",
  XAI_API_KEY: "synthetic-env-xai-key",
};

describe("the registry of image providers' packages", () => {
  const saved = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const [name, value] of Object.entries(outsideEnv)) {
      saved.set(name, process.env[name]);
      process.env[name] = value;
    }
  });

  afterAll(() => {
    for (const [name, value] of saved) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  });

  it.effect.each<{ readonly aspect: ImageAspect; readonly size: string }>([
    { aspect: "square", size: "1024x1024" },
    { aspect: "landscape", size: "1536x1024" },
    { aspect: "portrait", size: "1024x1536" },
  ])(
    "asks an OpenAI-compatible endpoint for a $aspect image as before",
    ({ aspect, size }) =>
      Effect.gen(function* compatible() {
        const request = yield* ask(
          settingsFor("openai-compatible", "https://images.example.test/v1"),
          aspect
        );

        assert.strictEqual(
          request.url,
          "https://images.example.test/v1/images/generations"
        );
        assert.strictEqual(
          request.headers["authorization"],
          "Bearer sk_test_synthetic_key"
        );
        // The model, the prompt, one image and its size, and nothing more.
        assert.deepStrictEqual(request.body, {
          model: "synthetic-image-model",
          n: 1,
          prompt: "A synthetic lighthouse.",
          size,
        });
      })
  );

  it.effect("sends no key to an endpoint that takes none", () =>
    Effect.gen(function* keyless() {
      const request = yield* ask(
        settingsFor(
          "openai-compatible",
          "https://images.example.test/v1",
          Option.none()
        )
      );

      assert.isUndefined(request.headers["authorization"]);
    })
  );

  it.effect(
    "asks OpenAI at its address, never the environment's, by size",
    () =>
      Effect.gen(function* openai() {
        const request = yield* ask(
          settingsFor("openai", "https://api.openai.com/v1")
        );

        assert.strictEqual(
          request.url,
          "https://api.openai.com/v1/images/generations"
        );
        assert.strictEqual(
          request.headers["authorization"],
          "Bearer sk_test_synthetic_key"
        );
        assert.strictEqual(fieldOf(request.body, "size"), "1536x1024");
        assert.strictEqual(fieldOf(request.body, "n"), 1);
      })
  );

  it.effect("asks xAI by aspect ratio, for base64", () =>
    Effect.gen(function* xai() {
      const request = yield* ask(settingsFor("xai", "https://api.x.ai/v1"));

      assert.strictEqual(request.url, "https://api.x.ai/v1/images/generations");
      assert.strictEqual(
        request.headers["authorization"],
        "Bearer sk_test_synthetic_key"
      );
      assert.strictEqual(fieldOf(request.body, "aspect_ratio"), "3:2");
      assert.strictEqual(fieldOf(request.body, "response_format"), "b64_json");
      assert.isNull(fieldOf(request.body, "size"));
    })
  );

  it.effect("asks Together AI by width and height", () =>
    Effect.gen(function* together() {
      const request = yield* ask(
        settingsFor("togetherai", "https://api.together.xyz/v1")
      );

      assert.strictEqual(
        request.url,
        "https://api.together.xyz/v1/images/generations"
      );
      assert.strictEqual(
        request.headers["authorization"],
        "Bearer sk_test_synthetic_key"
      );
      assert.deepStrictEqual(
        [fieldOf(request.body, "width"), fieldOf(request.body, "height")],
        [1536, 1024]
      );
    })
  );

  it.effect("asks Gemini for an image by aspect ratio, with its key", () =>
    Effect.gen(function* google() {
      const request = yield* ask(
        settingsFor(
          "google",
          "https://generativelanguage.googleapis.com/v1beta"
        ),
        "portrait"
      );

      assert.strictEqual(
        request.url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent"
      );
      assert.strictEqual(
        request.headers["x-goog-api-key"],
        "sk_test_synthetic_key"
      );
      assert.include(
        JSON.stringify(fieldOf(request.body, "generationConfig")),
        '"aspectRatio":"2:3"'
      );
    })
  );

  it.effect.each([401, 429, 500])(
    "fails by status alone on a %d, asking once",
    (status) =>
      Effect.gen(function* refused() {
        const { fetch, sent } = fakeFetch(status);

        const failure = yield* generateImageWith(
          settingsFor("openai-compatible", "https://images.example.test/v1"),
          { api: fetch, download: fetch },
          {
            prompt: "A synthetic lighthouse.",
            dimensions: { size: "1024x1024" },
          }
        ).pipe(Effect.flip);

        assert.deepStrictEqual(
          { kind: failure.kind, status: failure.status },
          { kind: "status", status }
        );
        assert.notInclude(JSON.stringify(failure), "synthetic refusal");
        // The SDK's retries are off.
        assert.lengthOf(sent, 1);
      })
  );

  it.effect("refuses a model named by a string alone, before any request", () =>
    Effect.gen(function* stringModel() {
      // Loading the registry replaces the SDK's default provider.
      imageModelOf(
        settingsFor("openai-compatible", "https://images.example.test/v1"),
        fakeFetch().fetch
      );

      const refused = yield* Effect.tryPromise(
        async () =>
          await generateImage({
            maxRetries: 0,
            model: "synthetic-image-model",
            prompt: "A synthetic lighthouse.",
          })
      ).pipe(Effect.flip);

      assert.isTrue(NoSuchModelError.isInstance(refused.cause));
    })
  );
});
