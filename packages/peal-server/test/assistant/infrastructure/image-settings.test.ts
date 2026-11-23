import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

import { imageProviderConfig } from "#assistant/infrastructure/assistant-settings.ts";

const imageProviderFrom = (env: Record<string, string>) =>
  imageProviderConfig.parse(ConfigProvider.fromUnknown(env));

const compatible = {
  PEAL_AI_IMAGE_BASE_URL: "http://127.0.0.1:8100/v1/",
  PEAL_AI_IMAGE_MODEL: "synthetic-image-model",
  PEAL_AI_IMAGE_PROVIDER: "openai-compatible",
};

describe("the image model's settings", () => {
  it.effect("leave images off unless a provider is named", () =>
    Effect.gen(function* off() {
      assert.strictEqual((yield* imageProviderFrom({}))._tag, "Off");
      assert.strictEqual(
        (yield* imageProviderFrom({ PEAL_AI_IMAGE_PROVIDER: "" }))._tag,
        "Off"
      );
      // The writing model's settings never turn images on.
      assert.strictEqual(
        (yield* imageProviderFrom({
          PEAL_AI_BASE_URL: "http://127.0.0.1:8000/v1",
          PEAL_AI_MODEL: "synthetic-model-8b",
          PEAL_AI_PROVIDER: "openai-compatible",
        }))._tag,
        "Off"
      );
    })
  );

  it.effect("reach an OpenAI-compatible endpoint, with or without a key", () =>
    Effect.gen(function* reach() {
      const plain = yield* imageProviderFrom(compatible);

      assert.deepStrictEqual(
        plain._tag === "On"
          ? {
              apiKey: plain.apiKey,
              baseUrl: plain.baseUrl,
              model: plain.model,
              provider: plain.provider,
            }
          : null,
        {
          apiKey: Option.none(),
          baseUrl: "http://127.0.0.1:8100/v1",
          model: "synthetic-image-model",
          provider: "openai-compatible",
        }
      );

      const keyed = yield* imageProviderFrom({
        ...compatible,
        PEAL_AI_IMAGE_API_KEY: "sk_test_synthetic_image_key",
      });

      assert.isTrue(
        keyed._tag === "On" &&
          Option.exists(
            keyed.apiKey,
            (key) => Redacted.value(key) === "sk_test_synthetic_image_key"
          )
      );
      assert.notInclude(JSON.stringify(keyed), "sk_test_synthetic_image_key");
    })
  );

  it.effect.each([
    {
      env: {
        PEAL_AI_IMAGE_MODEL: compatible.PEAL_AI_IMAGE_MODEL,
        PEAL_AI_IMAGE_PROVIDER: compatible.PEAL_AI_IMAGE_PROVIDER,
      },
      missing: "PEAL_AI_IMAGE_BASE_URL",
    },
    {
      env: {
        PEAL_AI_IMAGE_BASE_URL: compatible.PEAL_AI_IMAGE_BASE_URL,
        PEAL_AI_IMAGE_PROVIDER: compatible.PEAL_AI_IMAGE_PROVIDER,
      },
      missing: "PEAL_AI_IMAGE_MODEL",
    },
  ])("stop the server without $missing", ({ env, missing }) =>
    Effect.gen(function* required() {
      const failure = yield* imageProviderFrom(env).pipe(Effect.flip);

      assert.include(failure.message, missing);
    })
  );

  it.effect.each([
    {
      address: "https://api.openai.com/v1",
      provider: "openai",
    },
    {
      address: "https://generativelanguage.googleapis.com/v1beta",
      provider: "google",
    },
    { address: "https://api.x.ai/v1", provider: "xai" },
    { address: "https://api.together.xyz/v1", provider: "togetherai" },
  ])(
    "reach $provider at its own address, with its key",
    ({ address, provider }) =>
      Effect.gen(function* named() {
        const settings = yield* imageProviderFrom({
          PEAL_AI_IMAGE_API_KEY: "sk_test_synthetic_image_key",
          PEAL_AI_IMAGE_MODEL: "synthetic-image-model",
          PEAL_AI_IMAGE_PROVIDER: provider,
        });

        assert.deepStrictEqual(
          settings._tag === "On"
            ? { baseUrl: settings.baseUrl, provider: settings.provider }
            : null,
          { baseUrl: address, provider }
        );

        // Behind a proxy, at the address named.
        const proxied = yield* imageProviderFrom({
          PEAL_AI_IMAGE_API_KEY: "sk_test_synthetic_image_key",
          PEAL_AI_IMAGE_BASE_URL: "https://proxy.example.com/images/",
          PEAL_AI_IMAGE_MODEL: "synthetic-image-model",
          PEAL_AI_IMAGE_PROVIDER: provider,
        });

        assert.strictEqual(
          proxied._tag === "On" ? proxied.baseUrl : null,
          "https://proxy.example.com/images"
        );

        // Its key is required.
        const keyless = yield* imageProviderFrom({
          PEAL_AI_IMAGE_MODEL: "synthetic-image-model",
          PEAL_AI_IMAGE_PROVIDER: provider,
        }).pipe(Effect.flip);

        assert.include(keyless.message, "PEAL_AI_IMAGE_API_KEY");
      })
  );

  it.effect("refuse a provider they do not know", () =>
    Effect.gen(function* unknown() {
      const failure = yield* imageProviderFrom({
        ...compatible,
        PEAL_AI_IMAGE_PROVIDER: "anthropic",
      }).pipe(Effect.flip);

      assert.include(failure.message, "PEAL_AI_IMAGE_PROVIDER");
    })
  );
});
