import { once } from "node:events";

import { assert, describe, it } from "@effect/vitest";
import { APICallError } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { Deferred, Effect, Fiber, Schema, Stream } from "effect";
import { LanguageModel, Tool, Toolkit } from "effect/ai";

import { languageModelOn } from "#assistant/infrastructure/ai-sdk/language-model.ts";

// The adapter between effect/ai and the AI SDK, on the SDK's own mock
// model: what it asks the model for, and how it reads what comes back.
// Nothing here reaches a provider.

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

const usage = {
  inputTokens: {
    cacheRead: 30,
    cacheWrite: undefined,
    noCache: 90,
    total: 120,
  },
  outputTokens: { reasoning: undefined, text: 12, total: 12 },
};

const answering = (
  text: string,
  finish: GenerateResult["finishReason"]["unified"] = "stop"
): GenerateResult => ({
  content: [{ text, type: "text" }],
  finishReason: { raw: finish, unified: finish },
  usage,
  warnings: [],
});

const AnswerSchema = Schema.Struct({ text: Schema.String });

const adapted = (model: MockLanguageModelV4, kind = "openai-compatible") =>
  languageModelOn(model, {
    kind: kind === "anthropic" ? "anthropic" : "openai-compatible",
    maxOutputTokens: 4096,
  });

const failing = (statusCode: number) =>
  new MockLanguageModelV4({
    doGenerate: () => {
      throw new APICallError({
        message: "synthetic provider failure",
        requestBodyValues: { prompt: "synthetic-secret-draft" },
        responseBody: '{"error":{"message":"synthetic-secret-draft"}}',
        statusCode,
        url: "https://text.example.com/v1/chat/completions",
      });
    },
  });

// A client-run tool: effect/ai hands its call back rather than running it.
const GetPost = Tool.make("get_post", {
  description: "Reads a post",
  execution: "client",
  parameters: Schema.Struct({ postId: Schema.String }),
  success: Schema.String,
});

const toolkit = Toolkit.make(GetPost);

describe("effect/ai on the AI SDK", () => {
  it.effect("answers text, with its token counts, in one request", () =>
    Effect.gen(function* text() {
      const model = new MockLanguageModelV4({
        doGenerate: answering("A synthetic answer."),
      });

      const language = yield* adapted(model);

      const response = yield* language.generateText({
        prompt: [
          { content: "Rules.", role: "system" },
          { content: "A synthetic question.", role: "user" },
        ],
      });

      assert.strictEqual(response.text, "A synthetic answer.");
      assert.strictEqual(response.usage.inputTokens.total, 120);
      assert.strictEqual(response.usage.inputTokens.cacheRead, 30);
      assert.strictEqual(response.usage.outputTokens.total, 12);
      assert.strictEqual(response.finishReason, "stop");
      assert.lengthOf(model.doGenerateCalls, 1);

      const [call] = model.doGenerateCalls;

      assert.strictEqual(call?.maxOutputTokens, 4096);
      assert.deepStrictEqual(
        call?.prompt.map(({ role }) => role),
        ["system", "user"]
      );
    })
  );

  it.effect(
    "asks for the schema effect/ai writes, and decodes the answer",
    () =>
      Effect.gen(function* structured() {
        const model = new MockLanguageModelV4({
          doGenerate: answering('{"text":"A synthetic post."}'),
        });

        const language = yield* adapted(model);

        const response = yield* language.generateObject({
          objectName: "answer",
          prompt: "A synthetic draft.",
          schema: AnswerSchema,
        });

        assert.deepStrictEqual(response.value, { text: "A synthetic post." });

        const format = model.doGenerateCalls[0]?.responseFormat;

        assert.strictEqual(format?.type, "json");
        assert.strictEqual(
          format?.type === "json" ? format.name : null,
          "answer"
        );
        assert.include(
          JSON.stringify(format?.type === "json" ? format.schema : null),
          '"additionalProperties":false'
        );
      })
  );

  it.effect("asks Anthropic for its native structured output", () =>
    Effect.gen(function* anthropic() {
      const model = new MockLanguageModelV4({
        doGenerate: answering('{"text":"A synthetic post."}'),
      });

      const language = yield* adapted(model, "anthropic");

      yield* language.generateObject({
        objectName: "answer",
        prompt: "A synthetic draft.",
        schema: AnswerSchema,
      });

      assert.deepStrictEqual(model.doGenerateCalls[0]?.providerOptions, {
        anthropic: { structuredOutputMode: "outputFormat" },
      });
    })
  );

  it.effect("reads an answer that is not the object as unusable", () =>
    Effect.gen(function* unusable() {
      const model = new MockLanguageModelV4({
        doGenerate: answering("Here is your post."),
      });

      const language = yield* adapted(model);

      const failure = yield* language
        .generateObject({
          objectName: "answer",
          prompt: "A synthetic draft.",
          schema: AnswerSchema,
        })
        .pipe(Effect.flip);

      assert.include(
        ["InvalidOutputError", "InvalidResponseError", "StructuredOutputError"],
        failure.reason._tag
      );
    })
  );

  it.effect("tells a provider that declined to answer", () =>
    Effect.gen(function* declined() {
      const model = new MockLanguageModelV4({
        doGenerate: answering("", "content-filter"),
      });

      const language = yield* adapted(model);

      const failure = yield* language
        .generateText({ prompt: "A synthetic draft." })
        .pipe(Effect.flip);

      assert.strictEqual(failure.reason._tag, "ContentPolicyError");
    })
  );

  it.effect.each([
    { kind: "InvalidRequestError", status: 400 },
    { kind: "AuthenticationError", status: 401 },
    { kind: "UnknownError", status: 402 },
    { kind: "AuthenticationError", status: 403 },
    { kind: "InvalidRequestError", status: 404 },
    { kind: "InvalidRequestError", status: 422 },
    { kind: "RateLimitError", status: 429 },
    { kind: "InternalProviderError", status: 500 },
    { kind: "UnknownError", status: 302 },
  ])(
    "reads status $status as $kind, by its status alone, once",
    ({ kind, status }) =>
      Effect.gen(function* statuses() {
        const model = failing(status);
        const language = yield* adapted(model);

        const failure = yield* language
          .generateText({ prompt: "synthetic-secret-draft" })
          .pipe(Effect.flip);

        assert.strictEqual(failure.reason._tag, kind);
        assert.strictEqual(
          "http" in failure.reason
            ? failure.reason.http?.response?.status
            : null,
          status
        );
        // The SDK retries twice unless told not to.
        assert.lengthOf(model.doGenerateCalls, 1);
        // Nothing of the request or the answer is kept.
        assert.notInclude(JSON.stringify(failure), "synthetic-secret-draft");
        assert.notInclude(failure.message, "synthetic-secret-draft");
        assert.notProperty(failure.reason, "cause");
      })
  );

  it.effect("reads a 429 for a spent quota as the quota", () =>
    Effect.gen(function* quota() {
      const model = new MockLanguageModelV4({
        doGenerate: () => {
          throw new APICallError({
            message: "synthetic",
            requestBodyValues: {},
            responseBody: '{"error":{"code":"insufficient_quota"}}',
            statusCode: 429,
            url: "https://text.example.com/v1/chat/completions",
          });
        },
      });

      const language = yield* adapted(model);

      const failure = yield* language
        .generateText({ prompt: "A synthetic draft." })
        .pipe(Effect.flip);

      assert.strictEqual(failure.reason._tag, "QuotaExhaustedError");
    })
  );

  it.effect("reads a fetch that threw as the network's", () =>
    Effect.gen(function* network() {
      const model = new MockLanguageModelV4({
        doGenerate: () => {
          throw new TypeError("fetch refused for text.example.com");
        },
      });

      const language = yield* adapted(model);

      const failure = yield* language
        .generateText({ prompt: "A synthetic draft." })
        .pipe(Effect.flip);

      assert.strictEqual(failure.reason._tag, "NetworkError");
      assert.notInclude(JSON.stringify(failure), "text.example.com");
    })
  );

  it.effect("aborts the request when the call is interrupted", () =>
    Effect.gen(function* interrupted() {
      const started = yield* Deferred.make<AbortSignal>();

      const model = new MockLanguageModelV4({
        // Holds the request until it is aborted.
        doGenerate: async ({ abortSignal }) => {
          if (abortSignal !== undefined) {
            Deferred.doneUnsafe(started, Effect.succeed(abortSignal));
            await once(abortSignal, "abort");
          }

          throw new Error("aborted");
        },
      });

      const language = yield* adapted(model);

      const fiber = yield* language
        .generateText({ prompt: "A synthetic draft." })
        .pipe(Effect.forkChild);

      const signal = yield* Deferred.await(started);

      assert.isFalse(signal.aborted);

      yield* Fiber.interrupt(fiber);

      assert.isTrue(signal.aborted);
    })
  );

  it.effect(
    "streams text and a tool's call, advertised without running it",
    () =>
      Effect.gen(function* streamed() {
        const model = new MockLanguageModelV4({
          doStream: {
            stream: convertArrayToReadableStream([
              { type: "stream-start", warnings: [] },
              { id: "t", type: "text-start" },
              { delta: "Let me ", id: "t", type: "text-delta" },
              { delta: "look.", id: "t", type: "text-delta" },
              { id: "t", type: "text-end" },
              {
                input: '{"postId":"p1"}',
                toolCallId: "call_1",
                toolName: "get_post",
                type: "tool-call",
              },
              {
                finishReason: { raw: "tool_calls", unified: "tool-calls" },
                type: "finish",
                usage,
              },
            ]),
          },
        });

        const language = yield* adapted(model);

        const parts = yield* language
          .streamText({
            prompt: [
              {
                content: "Rules.",
                options: {
                  anthropic: { cacheControl: { type: "ephemeral" } },
                },
                role: "system",
              },
              { content: "Show my post.", role: "user" },
            ],
            toolkit,
          })
          .pipe(Stream.runCollect);

        assert.strictEqual(
          parts
            .flatMap((part) => (part.type === "text-delta" ? [part.delta] : []))
            .join(""),
          "Let me look."
        );

        const call = parts.find((part) => part.type === "tool-call");

        assert.deepStrictEqual(
          call?.type === "tool-call"
            ? { id: call.id, name: call.name, params: call.params }
            : null,
          { id: "call_1", name: "get_post", params: { postId: "p1" } }
        );

        const finish = parts.find((part) => part.type === "finish");

        assert.strictEqual(
          finish?.type === "finish" ? finish.usage.inputTokens.total : null,
          120
        );

        const [sent] = model.doStreamCalls;
        const [tool] = sent?.tools ?? [];

        assert.strictEqual(tool?.name, "get_post");
        assert.strictEqual(
          tool?.type === "function" ? tool.description : null,
          "Reads a post"
        );
        assert.strictEqual(tool?.type, "function");
        // The cache breakpoint reaches Anthropic's package.
        assert.deepStrictEqual(sent?.prompt[0]?.providerOptions, {
          anthropic: { cacheControl: { type: "ephemeral" } },
        });
      })
  );

  it.effect("fails the stream on the provider's error, by its status", () =>
    Effect.gen(function* streamFailure() {
      const model = new MockLanguageModelV4({
        doStream: () => {
          throw new APICallError({
            message: "synthetic",
            requestBodyValues: {},
            statusCode: 401,
            url: "https://text.example.com/v1/chat/completions",
          });
        },
      });

      const language = yield* adapted(model);

      const failure = yield* language
        .streamText({ prompt: "A synthetic draft." })
        .pipe(Stream.runCollect, Effect.flip);

      assert.strictEqual(failure.reason._tag, "AuthenticationError");
      assert.lengthOf(model.doStreamCalls, 1);
    })
  );

  it.effect("sends no tool when the call names none", () =>
    Effect.gen(function* none() {
      const model = new MockLanguageModelV4({
        doGenerate: answering("A synthetic answer."),
      });

      const language = yield* adapted(model);

      yield* LanguageModel.LanguageModel.use((service) =>
        service.generateText({ prompt: "A synthetic question." })
      ).pipe(Effect.provideService(LanguageModel.LanguageModel, language));

      assert.isUndefined(model.doGenerateCalls[0]?.tools);
    })
  );
});
