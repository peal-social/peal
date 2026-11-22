import { Effect, Option, Schema } from "effect";
import { Prompt } from "effect/ai";

import type { AgentMedia } from "#agent/domain/agent-parts.ts";
import { forModel } from "#agent/domain/tool-result.ts";

// What the model reads of a chat: the person's messages, the agent's text
// and tool calls, and the tools' answers, cut to a bound. Never an
// approval's request or answer: a call that waits has no result yet, and
// gets one once the person answers.

const decodePrompt = Schema.decodeUnknownEffect(Prompt.Prompt);

const encodePrompt = Schema.encodeEffect(Prompt.Prompt);

const decodeJson = Schema.decodeUnknownEffect(Schema.Json);

const jsonOf = Schema.decodeUnknownOption(Schema.Json);

/** A chat's history as stored; an empty one for a chat that has none yet. */
export const historyOf = (stored: Schema.Json): Effect.Effect<Prompt.Prompt> =>
  decodePrompt(stored).pipe(Effect.orElseSucceed(() => Prompt.empty));

/** A history as the chat keeps it. */
export const storedHistory = (
  history: Prompt.Prompt
): Effect.Effect<Schema.Json> =>
  encodePrompt(history).pipe(Effect.flatMap(decodeJson), Effect.orDie);

/** A tool's answer, as the model reads it. */
export interface CallResult {
  readonly callId: string;
  /** Its JSON, as the tool encoded it. */
  readonly encoded: Schema.Json;
  readonly isFailure: boolean;
  readonly tool: string;
}

/** A call the model made, with its parameters as JSON. */
export interface MadeCall {
  readonly callId: string;
  readonly params: Schema.Json;
  readonly tool: string;
}

const resultPart = ({ callId, encoded, isFailure, tool }: CallResult) =>
  Prompt.toolResultPart({
    id: callId,
    isFailure,
    name: tool,
    providerExecuted: false,
    result: forModel(encoded),
  });

/** The person's message, after the history. */
export const withUserMessage = (
  history: Prompt.Prompt,
  text: string,
  media: readonly AgentMedia[] = []
): Prompt.Prompt =>
  Prompt.concat(
    history,
    Prompt.fromMessages([
      Prompt.userMessage({
        content: [
          Prompt.textPart({ text }),
          // The files it attaches, as data beside it: which they are,
          // never their bytes.
          ...(media.length === 0
            ? []
            : [
                Prompt.textPart({
                  text: JSON.stringify({
                    attachments: media.map(({ id, kind, name }) => ({
                      kind,
                      mediaId: id,
                      name,
                    })),
                  }),
                }),
              ]),
        ],
      }),
    ])
  );

/**
 * One round of the model, after the history: what it wrote and the calls
 * it made, then the answers of those that ran. A round that wrote and
 * called nothing adds nothing.
 */
export const withRound = (
  history: Prompt.Prompt,
  text: string,
  calls: readonly MadeCall[],
  results: readonly CallResult[]
): Prompt.Prompt => {
  const said = text.length === 0 ? [] : [Prompt.textPart({ text })];

  const called = calls.map(({ callId, params, tool }) =>
    Prompt.toolCallPart({
      id: callId,
      name: tool,
      params,
      providerExecuted: false,
    })
  );

  if (said.length === 0 && called.length === 0) {
    return history;
  }

  const answered = calls.flatMap(({ callId }) =>
    results.filter((result) => result.callId === callId)
  );

  return Prompt.concat(
    history,
    Prompt.fromMessages([
      Prompt.assistantMessage({ content: [...said, ...called] }),
      ...(answered.length === 0
        ? []
        : [Prompt.toolMessage({ content: answered.map(resultPart) })]),
    ])
  );
};

/**
 * The answers of calls made in an earlier round, once the person decided
 * on them, after the history: in the tool message that answers that round
 * when it is the last, so each call's answer stays right after its call.
 */
export const withResults = (
  history: Prompt.Prompt,
  results: readonly CallResult[]
): Prompt.Prompt => {
  if (results.length === 0) {
    return history;
  }

  const parts = results.map(resultPart);
  const last = history.content.at(-1);

  if (last?.role === "tool") {
    return Prompt.fromMessages([
      ...history.content.slice(0, -1),
      Prompt.toolMessage({ content: [...last.content, ...parts] }),
    ]);
  }

  return Prompt.concat(
    history,
    Prompt.fromMessages([Prompt.toolMessage({ content: parts })])
  );
};

/** The calls of the history's last round that have no answer yet. */
export const unansweredCalls = (
  history: Prompt.Prompt
): readonly MadeCall[] => {
  const answered = new Set(
    history.content.flatMap((message) =>
      message.role === "tool"
        ? message.content.flatMap((part) =>
            part.type === "tool-result" ? [part.id] : []
          )
        : []
    )
  );

  return Option.match(
    Option.fromUndefinedOr(
      history.content.findLast((message) => message.role === "assistant")
    ),
    {
      onNone: () => [],
      onSome: (message) =>
        message.role === "assistant"
          ? message.content.flatMap((part) =>
              part.type === "tool-call" && !answered.has(part.id)
                ? [
                    {
                      callId: part.id,
                      params: Option.getOrElse(
                        jsonOf(part.params),
                        (): Schema.Json => ({})
                      ),
                      tool: part.name,
                    },
                  ]
                : []
            )
          : [],
    }
  );
};
