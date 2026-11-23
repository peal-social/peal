import { dynamicTool, generateText, jsonSchema, Output, streamText } from "ai";
import type {
  AssistantContent,
  FinishReason,
  LanguageModel as SdkLanguageModel,
  LanguageModelUsage,
  ModelMessage,
  SystemModelMessage,
  TextStreamPart,
  ToolContent,
  ToolSet,
  UserContent,
} from "ai";
import { Effect, flow, Option, Schema, Stream } from "effect";
import { AiError, LanguageModel, Prompt, Tool } from "effect/ai";
import type { Response } from "effect/ai";
import { toCodecAnthropic } from "effect/ai/AnthropicStructuredOutput";
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput";

import type { TextProviderKind } from "#assistant/domain/text-provider.ts";

import { providerStatusOf } from "./provider-status.ts";

const module = "AiSdkLanguageModel";

/** What the adapter is built with. */
export interface LanguageModelOptions {
  /** The API the model speaks, which sets how a schema is written for it. */
  readonly kind: TextProviderKind;
  /** The most tokens an answer may take. */
  readonly maxOutputTokens: number;
}

const isText = Schema.is(Schema.String);

const decodeJson = Schema.decodeUnknownOption(Schema.Json);

const decodeName = Schema.decodeUnknownOption(Schema.String);

// The only provider option Peal sets on a message: Anthropic's cache
// breakpoint. Anything else a prompt carries stays here.
const CacheControlSchema = Schema.Struct({
  anthropic: Schema.Struct({
    cacheControl: Schema.Struct({
      ttl: Schema.optionalKey(Schema.Literals(["5m", "1h"])),
      type: Schema.Literal("ephemeral"),
    }),
  }),
});

const decodeCacheControl = Schema.decodeUnknownOption(CacheControlSchema);

type SdkProviderOptions = NonNullable<SystemModelMessage["providerOptions"]>;

// A message's or a part's options as the SDK reads them, when it has any.
const providerOptionsOf = (
  options: Prompt.ProviderOptions
): Option.Option<SdkProviderOptions> =>
  decodeCacheControl(options).pipe(
    Option.map(({ anthropic: { cacheControl } }) => ({
      anthropic: { cacheControl },
    }))
  );

// A tool's answer as the provider reads it: its text, or its JSON as
// text, as effect/ai's own adapters send it.
const resultText = (part: Prompt.ToolResultPart): string => {
  if (part.modelOutput !== undefined) {
    return Prompt.toolModelOutputToText(part.modelOutput);
  }

  return isText(part.result) ? part.result : JSON.stringify(part.result);
};

type UserPart = Exclude<UserContent, string>[number];

type AssistantPart = Exclude<AssistantContent, string>[number];

type ToolPart = ToolContent[number];

const userPartOf = (part: Prompt.UserMessagePart): UserPart => {
  if (part.type === "text") {
    const text: UserPart = { text: part.text, type: "text" };

    Option.map(providerOptionsOf(part.options), (options) => {
      text.providerOptions = options;
    });

    return text;
  }

  const file: UserPart = {
    data: part.data,
    mediaType: part.mediaType,
    type: "file",
  };

  if (part.fileName !== undefined) {
    file.filename = part.fileName;
  }

  return file;
};

const assistantContentOf = (message: Prompt.AssistantMessage) =>
  message.content.flatMap((part): AssistantPart[] => {
    if (part.type === "text") {
      return [{ text: part.text, type: "text" }];
    }

    if (part.type === "reasoning") {
      return [{ text: part.text, type: "reasoning" }];
    }

    if (part.type === "tool-call" && !part.providerExecuted) {
      return [
        {
          input: part.params,
          toolCallId: part.id,
          toolName: part.name,
          type: "tool-call",
        },
      ];
    }

    return [];
  });

const toolContentOf = (message: Prompt.ToolMessage) =>
  message.content.flatMap((part): ToolPart[] =>
    part.type === "tool-result"
      ? [
          {
            output: {
              type: part.isFailure ? "error-text" : "text",
              value: resultText(part),
            },
            toolCallId: part.id,
            toolName: part.name,
            type: "tool-result",
          },
        ]
      : []
  );

const systemOf = (message: Prompt.SystemMessage): SystemModelMessage => {
  const system: SystemModelMessage = {
    content: message.content,
    role: "system",
  };

  Option.map(providerOptionsOf(message.options), (options) => {
    system.providerOptions = options;
  });

  return system;
};

/** What the SDK is asked, whatever the call. */
interface Asked {
  allowSystemInMessages?: true;
  instructions?: SystemModelMessage[];
  readonly maxOutputTokens: number;
  readonly maxRetries: 0;
  readonly messages: ModelMessage[];
  readonly telemetry: { readonly isEnabled: false };
  toolChoice?: ReturnType<typeof toolChoiceOf>;
  tools?: ToolSet;
}

// The tools as the SDK advertises them, with no `execute`: effect/ai runs
// them, and asks for approvals, itself. A tool is strict unless it says
// otherwise, as effect/ai's own adapters have it.
const toolsOf = (
  options: LanguageModel.ProviderOptions,
  strictTransformer: LanguageModel.CodecTransformer
): ToolSet => {
  const choice = options.toolChoice;

  const allowed =
    choice !== "auto" &&
    choice !== "none" &&
    choice !== "required" &&
    "oneOf" in choice
      ? new Set<string>(choice.oneOf)
      : null;

  const tools: ToolSet = {};

  for (const tool of options.tools) {
    // effect/ai types a tool's name loosely.
    const name = Option.getOrElse(decodeName(tool.name), () => "");

    if (
      name !== "" &&
      !Tool.isProviderDefined(tool) &&
      (allowed === null || allowed.has(name))
    ) {
      const strict = Tool.getStrictMode(tool) ?? true;

      const advertised = dynamicTool({
        inputSchema: jsonSchema(
          Tool.getJsonSchema(tool, {
            transformer: strict
              ? strictTransformer
              : LanguageModel.defaultCodecTransformer,
          })
        ),
        strict,
      });

      const description = Tool.getDescription(tool);

      if (description !== undefined) {
        advertised.description = description;
      }

      tools[name] = advertised;
    }
  }

  return tools;
};

const toolChoiceOf = (options: LanguageModel.ProviderOptions) => {
  const choice = options.toolChoice;

  if (choice === "auto" || choice === "none" || choice === "required") {
    return choice;
  }

  if ("tool" in choice) {
    return Option.match(decodeName(choice.tool), {
      onNone: () => "auto" as const,
      onSome: (toolName) => ({ toolName, type: "tool" as const }),
    });
  }

  return choice.mode === "required" ? "required" : "auto";
};

// What every call asks: the prompt, its leading system messages as
// instructions, the bound on the answer, one try, no telemetry, the tools.
const askedOf = (
  options: LanguageModel.ProviderOptions,
  own: LanguageModelOptions,
  strictTransformer: LanguageModel.CodecTransformer
): Asked => {
  const instructions: SystemModelMessage[] = [];
  const messages: ModelMessage[] = [];

  for (const message of options.prompt.content) {
    if (message.role === "system") {
      (messages.length === 0 ? instructions : messages).push(systemOf(message));
    } else if (message.role === "user") {
      messages.push({
        content: message.content.map(userPartOf),
        role: "user",
      });
    } else if (message.role === "assistant") {
      const content = assistantContentOf(message);

      if (content.length > 0) {
        messages.push({ content, role: "assistant" });
      }
    } else {
      const content = toolContentOf(message);

      if (content.length > 0) {
        messages.push({ content, role: "tool" });
      }
    }
  }

  const asked: Asked = {
    maxOutputTokens: own.maxOutputTokens,
    // A request is sent once: Peal says what a failure means.
    maxRetries: 0,
    messages,
    telemetry: { isEnabled: false },
  };

  if (instructions.length > 0) {
    asked.instructions = instructions;
  }

  // A system message after the conversation began is sent where it is.
  if (messages.some(({ role }) => role === "system")) {
    asked.allowSystemInMessages = true;
  }

  if (options.toolChoice !== "none" && options.tools.length > 0) {
    asked.tools = toolsOf(options, strictTransformer);
    asked.toolChoice = toolChoiceOf(options);
  }

  return asked;
};

const finishReasonOf = (
  reason: FinishReason
): Response.FinishPartEncoded["reason"] =>
  reason === "stop" ||
  reason === "length" ||
  reason === "content-filter" ||
  reason === "tool-calls" ||
  reason === "error" ||
  reason === "other"
    ? reason
    : "unknown";

// Only the counts that were reported: a key left out says nothing.
const usageOf = (
  usage: LanguageModelUsage
): Response.FinishPartEncoded["usage"] => {
  const inputTokens: Record<string, number> = {};
  const outputTokens: Record<string, number> = {};

  const counts = [
    [inputTokens, "total", usage.inputTokens],
    [inputTokens, "uncached", usage.inputTokenDetails.noCacheTokens],
    [inputTokens, "cacheRead", usage.inputTokenDetails.cacheReadTokens],
    [inputTokens, "cacheWrite", usage.inputTokenDetails.cacheWriteTokens],
    [outputTokens, "total", usage.outputTokens],
    [outputTokens, "text", usage.outputTokenDetails.textTokens],
    [outputTokens, "reasoning", usage.outputTokenDetails.reasoningTokens],
  ] as const;

  for (const [kept, key, value] of counts) {
    if (value !== undefined) {
      kept[key] = value;
    }
  }

  return { inputTokens, outputTokens };
};

// What the adapter reads of the SDK's failure: its kind (the error's
// name), the status it came with and the body, read for a quota's code
// alone. The error itself carries the request's body, the answer and the
// provider's words: it is never kept as a cause, logged or traced.
const SdkFailureSchema = Schema.Struct({
  name: Schema.String,
  responseBody: Schema.optional(Schema.String),
  statusCode: Schema.optional(Schema.Number),
});

type SdkFailure = typeof SdkFailureSchema.Type;

const readFailure = Schema.decodeUnknownOption(SdkFailureSchema);

// What an error body says when an account ran out of credit rather than
// sent too fast: read for its code alone, never kept.
const QuotaBodySchema = Schema.fromJsonString(
  Schema.Struct({
    error: Schema.Struct({
      code: Schema.optional(Schema.Unknown),
      type: Schema.optional(Schema.Unknown),
    }),
  })
);

const decodeQuotaBody = Schema.decodeUnknownOption(QuotaBodySchema);

const quotaExhausted = (body: string | undefined) =>
  Option.match(decodeQuotaBody(body), {
    onNone: () => false,
    onSome: ({ error }) =>
      [error.code, error.type].some(
        (value) =>
          isText(value) &&
          (value.toLowerCase().includes("quota") ||
            value.toLowerCase().includes("exhausted"))
      ),
  });

// A status as effect/ai's own adapters read it, with the status alone
// kept: never the body, the request or the provider's words.
const reasonOfStatus = (
  status: number,
  body: string | undefined
): AiError.AiErrorReason => {
  const http = { response: { headers: {}, status } };

  if (status === 404 || status === 409 || status === 422) {
    return new AiError.InvalidRequestError({ http });
  }

  if (status === 429 && quotaExhausted(body)) {
    return new AiError.QuotaExhaustedError({ http });
  }

  return AiError.reasonFromHttpStatus({ http, status });
};

const networkError = new AiError.NetworkError({
  method: "POST",
  reason: "TransportError",
  url: "",
});

// The failures that say the answer could not be read.
const unreadable: ReadonlySet<string> = new Set([
  "AI_InvalidResponseDataError",
  "AI_JSONParseError",
  "AI_TypeValidationError",
]);

// A fetch that threw (the guard refused the address, the answer went past
// its bound, the connection failed) or was aborted.
const unsent: ReadonlySet<string> = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
]);

const reasonOf = (failure: Option.Option<SdkFailure>): AiError.AiErrorReason =>
  Option.match(failure, {
    onNone: () => new AiError.UnknownError({}),
    onSome: ({ name, responseBody, statusCode }) => {
      if (name === "AI_APICallError") {
        return statusCode === undefined
          ? networkError
          : reasonOfStatus(
              providerStatusOf(statusCode, responseBody),
              responseBody
            );
      }

      if (name === "AI_NoObjectGeneratedError") {
        return new AiError.InvalidOutputError({
          description: "The answer is not the object asked for",
        });
      }

      if (unreadable.has(name)) {
        return new AiError.InvalidResponseError({
          description: "The provider's answer could not be read",
        });
      }

      return unsent.has(name) ? networkError : new AiError.UnknownError({});
    },
  });

/**
 * The SDK's failure as effect/ai's, by its kind and status alone (see
 * `SdkFailureSchema`).
 */
export const aiErrorOf = (method: string) =>
  flow(readFailure, reasonOf, (reason) =>
    AiError.make({ method, module, reason })
  );

const contentFiltered = (method: string) =>
  AiError.make({
    method,
    module,
    reason: new AiError.ContentPolicyError({
      description: "The provider declined to answer",
    }),
  });

// The SDK's stream reports its errors as parts, which the adapter reads:
// they are never written to the console.
const unreported = (): void => undefined;

// What effect/ai reads of a whole answer.
interface Generated {
  readonly content: Awaited<ReturnType<typeof generateText>>["content"];
  readonly finishReason: FinishReason;
  readonly totalUsage: LanguageModelUsage;
}

// A whole answer as effect/ai's parts: a refusal of the provider's fails,
// as the answer it cut short is none.
const partsOf = (
  result: Generated
): Effect.Effect<Response.PartEncoded[], AiError.AiError> => {
  if (result.finishReason === "content-filter") {
    return Effect.fail(contentFiltered("generateText"));
  }

  const parts: Response.PartEncoded[] = [];

  for (const part of result.content) {
    if (part.type === "text") {
      parts.push({ text: part.text, type: "text" });
    } else if (part.type === "reasoning") {
      parts.push({ text: part.text, type: "reasoning" });
    } else if (part.type === "tool-call") {
      parts.push({
        id: part.toolCallId,
        name: part.toolName,
        params: Option.getOrNull(decodeJson(part.input)),
        type: "tool-call",
      });
    }
  }

  parts.push({
    reason: finishReasonOf(result.finishReason),
    type: "finish",
    usage: usageOf(result.totalUsage),
  });

  return Effect.succeed(parts);
};

type StreamPart = Response.StreamPartEncoded;

// A part of the SDK's stream as effect/ai's, or nothing for the parts
// effect/ai has no use for; an error part fails the stream.
const streamPartOf = (
  part: TextStreamPart<ToolSet>
): Stream.Stream<StreamPart, AiError.AiError> => {
  if (
    part.type === "text-start" ||
    part.type === "text-end" ||
    part.type === "reasoning-start" ||
    part.type === "reasoning-end"
  ) {
    return Stream.succeed<StreamPart>({ id: part.id, type: part.type });
  }

  if (part.type === "text-delta" || part.type === "reasoning-delta") {
    return Stream.succeed<StreamPart>({
      delta: part.text,
      id: part.id,
      type: part.type,
    });
  }

  if (part.type === "tool-call") {
    return Stream.succeed<StreamPart>({
      id: part.toolCallId,
      name: part.toolName,
      params: Option.getOrNull(decodeJson(part.input)),
      type: "tool-call",
    });
  }

  if (part.type === "finish") {
    return Stream.succeed<StreamPart>({
      reason: finishReasonOf(part.finishReason),
      type: "finish",
      usage: usageOf(part.totalUsage),
    });
  }

  return part.type === "error"
    ? Stream.fail(aiErrorOf("streamText")(part.error))
    : Stream.empty;
};

/**
 * effect/ai's LanguageModel on an AI SDK model: the agent and the writing
 * assistant keep effect/ai's run loop, its tools, approvals and structured
 * output, and only the model underneath is the SDK's. Each call goes to
 * the SDK's `generateText` or `streamText` once (no retry), with its
 * telemetry off and the fiber's abort signal, so interrupting the call
 * aborts its request. Tools are advertised without `execute`, so a call
 * ends the SDK's step and effect/ai runs it. Structured output asks for
 * the schema effect/ai writes (strict, for Anthropic's or OpenAI's
 * rules), and effect/ai decodes the text. Token counts come back in the
 * `finish` part. The SDK's errors become AiError by kind and status
 * alone.
 */
export const languageModelOn = (
  model: SdkLanguageModel,
  own: LanguageModelOptions
): Effect.Effect<LanguageModel.LanguageModel> => {
  const codecTransformer =
    own.kind === "anthropic" ? toCodecAnthropic : toCodecOpenAI;

  // Anthropic's package would answer a JSON request through a tool on
  // models it does not know: effect/ai's adapter asked for the native
  // format, and so does this one.
  const structuredMode =
    own.kind === "anthropic"
      ? { anthropic: { structuredOutputMode: "outputFormat" } }
      : {};

  return LanguageModel.make({
    codecTransformer,
    generateText: (options) => {
      const { responseFormat } = options;
      const asked = askedOf(options, own, codecTransformer);

      const answered: Effect.Effect<Generated, AiError.AiError> =
        responseFormat.type === "json"
          ? Effect.tryPromise({
              catch: aiErrorOf("generateText"),
              try: async (abortSignal) =>
                await generateText({
                  ...asked,
                  abortSignal,
                  model,
                  output: Output.object({
                    name: responseFormat.objectName,
                    schema: jsonSchema(
                      Tool.getJsonSchemaFromSchema(responseFormat.schema, {
                        transformer: codecTransformer,
                      })
                    ),
                  }),
                  providerOptions: structuredMode,
                }),
            })
          : Effect.tryPromise({
              catch: aiErrorOf("generateText"),
              try: async (abortSignal) =>
                await generateText({ ...asked, abortSignal, model }),
            });

      return answered.pipe(Effect.flatMap(partsOf));
    },
    streamText: (options) =>
      Stream.unwrap(
        Effect.acquireRelease(
          Effect.sync(() => new AbortController()),
          (controller) =>
            Effect.sync(() => {
              controller.abort();
            })
        ).pipe(
          Effect.map((controller) => {
            const result = streamText({
              ...askedOf(options, own, codecTransformer),
              abortSignal: controller.signal,
              model,
              onError: unreported,
            });

            return Stream.fromAsyncIterable(
              result.stream,
              aiErrorOf("streamText")
            ).pipe(Stream.flatMap(streamPartOf));
          })
        )
      ),
  });
};
