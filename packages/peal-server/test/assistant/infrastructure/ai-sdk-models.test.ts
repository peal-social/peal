import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { generateText, NoSuchModelError } from "ai";
import { Effect, Option, Redacted, Schema } from "effect";

import type { TextProviderId } from "#assistant/domain/text-provider.ts";
import { textModelOf } from "#assistant/infrastructure/ai-sdk/models.ts";
import type { TextModelSettings } from "#assistant/infrastructure/ai-sdk/models.ts";
import { languageModelOf } from "#assistant/infrastructure/writing-model-live.ts";

// Each provider's package as the registry builds it, on a fake fetch that
// keeps what it is sent: the address, the key's header and the body.
// Nothing here reaches a provider.

interface Sent {
  readonly body: { readonly [key: string]: Schema.Json };
  readonly headers: Readonly<Record<string, string>>;
  readonly url: string;
}

const decodeBody = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json))
);

const anthropicMessage = {
  content: [{ text: '{"text":"A synthetic post."}', type: "text" }],
  id: "msg_synthetic",
  model: "claude-opus-5-5",
  role: "assistant",
  stop_reason: "end_turn",
  stop_sequence: null,
  type: "message",
  usage: { input_tokens: 120, output_tokens: 12 },
};

const chatCompletion = {
  choices: [
    {
      finish_reason: "stop",
      index: 0,
      message: { content: '{"text":"A synthetic post."}', role: "assistant" },
    },
  ],
  created: 1_762_646_400,
  id: "chatcmpl-synthetic",
  model: "synthetic-model",
  object: "chat.completion",
  usage: { completion_tokens: 12, prompt_tokens: 120, total_tokens: 132 },
};

// A fetch that answers as the provider would, and keeps every request.
const fakeFetch = () => {
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

      return Response.json(
        request.url.endsWith("/messages") ? anthropicMessage : chatCompletion
      );
    },
    { preconnect: globalThis.fetch.preconnect }
  );

  return { fetch, sent };
};

const AnswerSchema = Schema.Struct({ text: Schema.String });

const settingsFor = (
  provider: TextProviderId,
  baseUrl: string,
  apiKey: Option.Option<string> = Option.some("sk_test_synthetic_key")
): TextModelSettings => ({
  apiKey: apiKey.pipe(Option.map(Redacted.make)),
  baseUrl,
  model: "synthetic-model",
  provider,
});

// One structured answer through effect/ai, inside a span of Peal's.
const ask = (settings: TextModelSettings) =>
  Effect.gen(function* asked() {
    const { fetch, sent } = fakeFetch();
    const model = yield* languageModelOf(settings, fetch);

    const answer = yield* model
      .generateObject({
        objectName: "answer",
        prompt: [
          { content: "Rules.", role: "system" },
          { content: '{"draft":"A synthetic draft."}', role: "user" },
        ],
        schema: AnswerSchema,
      })
      .pipe(Effect.withSpan("test.ask"));

    assert.deepStrictEqual(answer.value, { text: "A synthetic post." });
    assert.lengthOf(sent, 1);

    const [request] = sent;

    assert.isDefined(request);
    // Peal's trace context stays with Peal.
    assert.isUndefined(request?.headers["traceparent"]);

    return request ?? { body: {}, headers: {}, url: "" };
  });

const fieldOf = (body: Sent["body"], key: string) =>
  Option.fromUndefinedOr(body[key]);

// What the SDK's factories would read when Peal gave them nothing.
const outsideEnv = {
  ANTHROPIC_API_KEY: "synthetic-env-anthropic-key",
  ANTHROPIC_BASE_URL: "https://env.example.test/anthropic",
  DEEPSEEK_API_KEY: "synthetic-env-deepseek-key",
  OPENAI_API_KEY: "synthetic-env-openai-key",
};

describe("the registry of providers' packages", () => {
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

  it.effect(
    "asks Anthropic at its address's /v1/messages, never the environment's",
    () =>
      Effect.gen(function* anthropic() {
        const request = yield* ask(
          settingsFor("anthropic", "https://proxy.example.test/anthropic")
        );

        assert.strictEqual(
          request.url,
          "https://proxy.example.test/anthropic/v1/messages"
        );
        assert.strictEqual(
          request.headers["x-api-key"],
          "sk_test_synthetic_key"
        );
        assert.strictEqual(
          Option.getOrNull(fieldOf(request.body, "max_tokens")),
          4096
        );
        assert.include(
          JSON.stringify(fieldOf(request.body, "output_config")),
          "json_schema"
        );
      })
  );

  it.effect("asks an OpenAI-compatible endpoint for a strict JSON schema", () =>
    Effect.gen(function* compatible() {
      const request = yield* ask(
        settingsFor("openai-compatible", "https://text.example.test/v1")
      );

      assert.strictEqual(
        request.url,
        "https://text.example.test/v1/chat/completions"
      );
      assert.strictEqual(
        request.headers["authorization"],
        "Bearer sk_test_synthetic_key"
      );
      assert.deepStrictEqual(
        Option.getOrNull(fieldOf(request.body, "max_tokens")),
        4096
      );

      const format = JSON.stringify(
        Option.getOrNull(fieldOf(request.body, "response_format"))
      );

      assert.include(format, '"type":"json_schema"');
      assert.include(format, '"strict":true');
      assert.include(format, '"name":"answer"');
    })
  );

  it.effect("sends no key to an endpoint that takes none", () =>
    Effect.gen(function* keyless() {
      const request = yield* ask(
        settingsFor(
          "openai-compatible",
          "https://text.example.test/v1",
          Option.none()
        )
      );

      assert.isUndefined(request.headers["authorization"]);
    })
  );

  it.effect("asks DeepSeek for a JSON object, its schema in the prompt", () =>
    Effect.gen(function* deepseek() {
      const request = yield* ask(
        settingsFor("deepseek", "https://api.deepseek.com")
      );

      assert.strictEqual(
        request.url,
        "https://api.deepseek.com/chat/completions"
      );
      assert.strictEqual(
        request.headers["authorization"],
        "Bearer sk_test_synthetic_key"
      );
      assert.include(
        JSON.stringify(fieldOf(request.body, "response_format")),
        '"type":"json_object"'
      );
    })
  );

  it.effect("tells OpenRouter to keep to hosts that take every parameter", () =>
    Effect.gen(function* openrouter() {
      const request = yield* ask(
        settingsFor("openrouter", "https://openrouter.ai/api/v1")
      );

      assert.strictEqual(
        request.url,
        "https://openrouter.ai/api/v1/chat/completions"
      );
      assert.deepStrictEqual(
        Option.getOrNull(fieldOf(request.body, "provider")),
        { require_parameters: true }
      );
    })
  );

  it.effect.each([
    { address: "https://api.cerebras.ai/v1", provider: "cerebras" as const },
    {
      address: "https://api.fireworks.ai/inference/v1",
      provider: "fireworks" as const,
    },
    { address: "https://api.mistral.ai/v1", provider: "mistral" as const },
    { address: "https://api.openai.com/v1", provider: "openai" as const },
  ])("asks $provider at its address, with its key", ({ address, provider }) =>
    Effect.gen(function* known() {
      const request = yield* ask(settingsFor(provider, address));

      assert.strictEqual(request.url, `${address}/chat/completions`);
      assert.strictEqual(
        request.headers["authorization"],
        "Bearer sk_test_synthetic_key"
      );
    })
  );

  it.effect("refuses a model named by a string alone, before any request", () =>
    Effect.gen(function* stringModel() {
      // Loading the registry replaces the SDK's default provider.
      textModelOf(
        settingsFor("openai-compatible", "https://text.example.test/v1"),
        fakeFetch().fetch
      );

      const refused = yield* Effect.tryPromise(
        async () =>
          await generateText({
            maxRetries: 0,
            model: "synthetic-model",
            prompt: "A synthetic draft.",
          })
      ).pipe(Effect.flip);

      // No model of that name, rather than a request to the SDK's gateway.
      assert.isTrue(NoSuchModelError.isInstance(refused.cause));
    })
  );
});
