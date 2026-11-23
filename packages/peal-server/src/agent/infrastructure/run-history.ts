import { Effect, Option, Schema } from "effect";
import { Prompt } from "effect/ai";

import type { AgentMedia } from "#agent/domain/agent-parts.ts";
import type { AgentSkill } from "#agent/domain/agent-skill.ts";
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

/** What comes beside the person's words: the files and skills of their message. */
export interface BesideMessage {
  readonly media?: readonly AgentMedia[];
  /** The other skills they may use, which the agent may read. */
  readonly offeredSkills?: readonly AgentSkill[];
  /** The skills they picked for it. */
  readonly skills?: readonly AgentSkill[];
}

// A part of JSON beside the message, when there is anything to say.
const besidePart = (items: readonly unknown[], data: Schema.Json) =>
  items.length === 0 ? [] : [Prompt.textPart({ text: JSON.stringify(data) })];

/** The person's message, after the history. */
export const withUserMessage = (
  history: Prompt.Prompt,
  text: string,
  { media = [], offeredSkills = [], skills = [] }: BesideMessage = {}
): Prompt.Prompt =>
  Prompt.concat(
    history,
    Prompt.fromMessages([
      Prompt.userMessage({
        content: [
          Prompt.textPart({ text }),
          // The files it attaches, as data beside it: which they are,
          // never their bytes.
          ...besidePart(media, {
            attachments: media.map(({ id, kind, name }) => ({
              kind,
              mediaId: id,
              name,
            })),
          }),
          // The skills the person picked for it, to follow for it: their
          // names and instructions, beside the message, never in the
          // rules.
          ...besidePart(skills, {
            skills: skills.map(({ id, instructions, name }) => ({
              instructions,
              name,
              skillId: id,
            })),
          }),
          // The other skills they may use, by id and name, which the
          // agent reads when a request fits one.
          ...besidePart(offeredSkills, {
            otherSkills: offeredSkills.map(({ id, name }) => ({
              name,
              skillId: id,
            })),
          }),
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

// How much of the budget a message takes: its text, its calls' names and
// parameters, its tools' answers, as the provider is sent them.
const sizeOf = (message: Prompt.Message): number => {
  if (message.role === "system") {
    return message.content.length;
  }

  let size = 0;

  for (const part of message.content) {
    if (part.type === "text") {
      size += part.text.length;
    } else if (part.type === "tool-call") {
      size += part.name.length + JSON.stringify(part.params).length;
    } else if (part.type === "tool-result") {
      size += part.name.length + JSON.stringify(part.result).length;
    }
  }

  return size;
};

const total = (messages: readonly Prompt.Message[]): number =>
  messages.reduce((sum, message) => sum + sizeOf(message), 0);

// Messages split where each group starts: a group is never cut.
const groupsFrom = (
  messages: readonly Prompt.Message[],
  starts: (message: Prompt.Message) => boolean
): Prompt.Message[][] => {
  const groups: Prompt.Message[][] = [];

  for (const message of messages) {
    const last = groups.at(-1);

    if (last === undefined || starts(message)) {
      groups.push([message]);
    } else {
      last.push(message);
    }
  }

  return groups;
};

// The newest groups that fit in what is left, oldest first, the last one
// always: it is what the round answers.
const newestWithin = (
  groups: readonly (readonly Prompt.Message[])[],
  budget: number
): readonly Prompt.Message[] => {
  const kept: (readonly Prompt.Message[])[] = [];
  let left = budget;

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index] ?? [];
    const size = total(group);

    if (kept.length > 0 && size > left) {
      break;
    }

    kept.unshift(group);
    left -= size;
  }

  return kept.flat();
};

/**
 * What a round sends of the history, within `budget` (`maxHistoryLength`):
 * all of it when it fits; else its latest turns, each from a person's
 * message, the oldest dropped first. The person's last message and what
 * came of it are always sent; when they alone pass the budget, the
 * earliest rounds after the message go, each round's calls with their
 * answers, never the last round, whose calls may wait for the person's
 * approval. The chat keeps its whole history: only what is sent is cut.
 */
export const withinBudget = (
  history: Prompt.Prompt,
  budget: number
): Prompt.Prompt => {
  const messages = history.content;

  if (total(messages) <= budget) {
    return history;
  }

  const turns = groupsFrom(messages, ({ role }) => role === "user");
  const [message, ...rounds] = turns.at(-1) ?? [];
  const last = message === undefined ? 0 : sizeOf(message);

  // The last turn passes the budget alone: its message, then its rounds,
  // each an answer of the model and the tools' answers after it.
  if (total(turns.at(-1) ?? []) > budget && message !== undefined) {
    const own = groupsFrom(rounds, ({ role }) => role === "assistant");

    return Prompt.fromMessages([message, ...newestWithin(own, budget - last)]);
  }

  return Prompt.fromMessages([...newestWithin(turns, budget)]);
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
