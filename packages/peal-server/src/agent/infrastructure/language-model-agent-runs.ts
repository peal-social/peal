import {
  Cause,
  Clock,
  DateTime,
  Effect,
  Exit,
  flow,
  Layer,
  Option,
  Queue,
  Ref,
  Schema,
  Stream,
} from "effect";
import { AiError, Prompt } from "effect/ai";
import type { LanguageModel, Response } from "effect/ai";
import { CurrentMember } from "peal-contract";
import type { Member } from "peal-contract";

import { AgentModelOff } from "#agent/application/agent-model-off.ts";
import { DayExhausted } from "#agent/application/day-exhausted.ts";
import { OwnProviderBusy } from "#agent/application/own-provider-busy.ts";
import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import { AgentRuns } from "#agent/application/ports/agent-runs.ts";
import type { RunRequest } from "#agent/application/ports/agent-runs.ts";
import {
  answered,
  approvalOf,
  pendingOf,
} from "#agent/domain/agent-approvals.ts";
import { cardOf } from "#agent/domain/agent-cards.ts";
import type { AgentEvent } from "#agent/domain/agent-event.ts";
import { agentInstructions } from "#agent/domain/agent-instructions.ts";
import { AgentMessage } from "#agent/domain/agent-message.ts";
import type {
  AgentApproval,
  AgentAvailability,
  AgentFailure,
  AgentOffReason,
  AgentOutcome,
  AgentSource,
  AgentStepState,
} from "#agent/domain/agent-parts.ts";
import { approvedTools, draftFreeTools } from "#agent/domain/agent-toolset.ts";
import { applied, emptyAnswer } from "#agent/domain/answer-draft.ts";
import type { AnswerDraft } from "#agent/domain/answer-draft.ts";
import {
  acceptedTitle,
  fallbackTitle,
  TitleAnswerSchema,
  titleInstructions,
} from "#agent/domain/chat-title.ts";
import { AgentMessageIdSchema } from "#agent/domain/ids.ts";
import {
  maxAnswerLength,
  maxRounds,
  roundTimeout,
  runTimeout,
  titleTimeout,
} from "#agent/domain/run-limits.ts";
import { postOf } from "#agent/domain/tool-items.ts";
import { AgentLanguageModels } from "#agent/infrastructure/agent-language-models.ts";
import { AgentToolbox } from "#agent/infrastructure/agent-toolbox.ts";
import type { AgentTool } from "#agent/infrastructure/agent-toolbox.ts";
import { RunEnded } from "#agent/infrastructure/run-ended.ts";
import {
  historyOf,
  storedHistory,
  unansweredCalls,
  withResults,
  withRound,
  withUserMessage,
} from "#agent/infrastructure/run-history.ts";
import type {
  CallResult,
  MadeCall,
} from "#agent/infrastructure/run-history.ts";
import { AgentModelAccess } from "#assistant/application/agent-model-access.ts";
import type { RoundClaim } from "#assistant/application/agent-model-access.ts";
import { WritingAssistant } from "#assistant/application/writing-assistant.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import { storableText } from "#shared/domain/platform-text.ts";

/** What the model reads in place of a change that waited and was not made. */
const notMade = {
  declined:
    "The person declined this change: nothing was done. Do not ask again unless they ask for it.",
  expired:
    "The person wrote again instead of answering: this change was not made.",
} as const;

// The tools that run only once the person approved them, on any post or a
// post that is not a draft.
const asking: ReadonlySet<string> = new Set([
  ...approvedTools,
  ...draftFreeTools,
]);

// The tools and the system message are the same each round of a run:
// Anthropic caches what comes before this breakpoint (the tools, then the
// system message), so each later round reads them from its cache. Other
// providers read no such option.
const cachedPrefix = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

// What a provider and a tool send is read as JSON, at once.
const decodeJson = Schema.decodeUnknownEffect(Schema.Json);

const asJson = flow(
  decodeJson,
  Effect.orElseSucceed((): Schema.Json => null)
);

const decodePostNamed = Schema.decodeUnknownOption(
  Schema.Struct({ postId: Schema.String })
);

const isRefusal = Schema.is(
  Schema.Struct({ _tag: Schema.Literal("ToolRefused") })
);

/** How a tool's call ended, as its step shows it. */
const stateOf = (isFailure: boolean, encoded: Schema.Json): AgentStepState => {
  if (!isFailure) {
    return "done";
  }

  return isRefusal(encoded) ? "refused" : "failed";
};

// The failures that come with an answer from the provider: it ran the
// request.
const answeredKinds: ReadonlySet<string> = new Set([
  "InvalidOutputError",
  "InvalidResponseError",
  "StructuredOutputError",
  "ToolParameterValidationError",
]);

const refusedKinds: ReadonlySet<string> = new Set([
  "AuthenticationError",
  "ContentPolicyError",
  "InvalidRequestError",
  "QuotaExhaustedError",
]);

/** A provider's failure, by its kind alone. */
const failureOf = (error: AiError.AiError): AgentFailure => {
  const kind = error.reason._tag;

  if (answeredKinds.has(kind)) {
    return "unusableAnswer";
  }

  return refusedKinds.has(kind) ? "providerRefused" : "unreachable";
};

// Why nobody answers: the server's model needs a payment method, or
// there is no model at all.
const offReasonOf = (reason: string | null): AgentOffReason =>
  reason === "paymentMethod" ? "paymentMethod" : "noModel";

const availabilityOf = ({
  reason,
  source,
}: {
  readonly reason: string | null;
  readonly source: AgentSource | null;
}): AgentAvailability => ({
  available: source !== null,
  reason: source === null ? offReasonOf(reason) : null,
  source,
});

const off: AgentAvailability = {
  available: false,
  reason: "noModel",
  source: null,
};

interface RoundOutcome {
  readonly approvals: readonly AgentApproval[];
  readonly calls: readonly MadeCall[];
  readonly results: readonly CallResult[];
  readonly text: string;
}

const millisSince = (startedAt: number) =>
  Clock.currentTimeMillis.pipe(
    Effect.map((now) => Math.max(0, Math.round(now - startedAt)))
  );

// The provider's refusal or failure, by its kind; anything else is the
// run's own failure.
const roundFailure = (error: AiError.AiError | RunEnded) =>
  AiError.isAiError(error) ? new RunEnded({ reason: failureOf(error) }) : error;

const runFailureOf = (cause: Cause.Cause<unknown>): AgentFailure =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: (): AgentFailure => "failed",
    onSome: (error): AgentFailure =>
      error instanceof RunEnded ? error.reason : "failed",
  });

/**
 * AgentRuns on effect/ai: each round streams the model's answer with the
 * agent's toolkit, the tools the model calls running as it goes but those
 * that wait for the person's approval, which end the run; up to
 * `maxRounds` rounds, each bounded by `roundTimeout`, the run by
 * `runTimeout`. Who answers is the writing assistant's choice
 * (AgentModelAccess), each round claimed of its allowance before it is
 * sent. The answer and the chat's history are kept when the run ends,
 * however it ends: stopped by the person, it keeps what was written.
 *
 * Nothing of a message, a prompt, a tool's parameters or answer, or a
 * provider's error reaches a log or a span: effect/ai's spans are off
 * around each round, and the run's own span and log line say the source,
 * the rounds, the tools' names, the outcome and the kind of failure.
 */
export const LanguageModelAgentRunsLive = Layer.effect(
  AgentRuns,
  Effect.gen(function* LanguageModelAgentRuns() {
    const access = yield* AgentModelAccess;
    const assistant = yield* WritingAssistant;
    const models = yield* AgentLanguageModels;
    const toolbox = yield* AgentToolbox;
    const chats = yield* AgentChats;
    const ids = yield* Ids;

    const availability = (actor: RunRequest["actor"]) =>
      assistant.status(actor).pipe(
        Effect.map(availabilityOf),
        Effect.catchTag("MissingPermission", () => Effect.succeed(off))
      );

    // A tool's call that the person approved, with their permissions as
    // they are now: its answer, as JSON, and whether it refused.
    const runApproved = (member: Member, call: MadeCall) =>
      toolbox.toolkit.handle(call.tool, call.params, call.callId).pipe(
        Effect.flatMap(Stream.runLast),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.succeed<CallResult>({
                callId: call.callId,
                encoded: null,
                isFailure: true,
                tool: call.tool,
              }),
            onSome: (result) =>
              asJson(result.encodedResult).pipe(
                Effect.map((encoded): CallResult => ({
                  callId: call.callId,
                  encoded,
                  isFailure: result.isFailure,
                  tool: call.tool,
                }))
              ),
          })
        ),
        Effect.provideService(CurrentMember, member),
        Effect.withTracerEnabled(false),
        Effect.mapError(() => new RunEnded({ reason: "failed" }))
      );

    // The post a call names, as the workspace holds it, for its approval.
    const postNamed = (member: Member, params: Schema.Json) =>
      Option.match(decodePostNamed(params), {
        onNone: () => Effect.succeedNone,
        onSome: ({ postId }) =>
          toolbox.toolkit.handle("get_post", { postId }).pipe(
            Effect.flatMap(Stream.runLast),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeedNone,
                onSome: (result) =>
                  result.isFailure
                    ? Effect.succeedNone
                    : asJson(result.encodedResult).pipe(Effect.map(postOf)),
              })
            ),
            Effect.provideService(CurrentMember, member),
            Effect.withTracerEnabled(false),
            Effect.orElseSucceed(() => Option.none())
          ),
      });

    const start = Effect.fn("AgentRuns.start")(function* start(
      request: RunRequest
    ) {
      const { actor, chat, input, origin, timeZone } = request;

      const member = yield* Effect.serviceOption(CurrentMember).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.die("A run of the agent needs its member"),
            onSome: Effect.succeed,
          })
        )
      );

      const lease = yield* access.open(actor).pipe(
        Effect.map(Option.some),
        Effect.catchTags({
          AssistantUnavailable: () => Effect.fail(new AgentModelOff()),
          OwnTextBusy: () => Effect.fail(new OwnProviderBusy()),
          // A key that no longer opens: the run fails at once, as the
          // provider refusing the workspace's settings.
          TextProviderRefused: () => Effect.succeedNone,
        })
      );

      const chosen = yield* Option.match(lease, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: ({ endpoint }) =>
          Option.match(endpoint, {
            onNone: () =>
              Option.match(models.server, {
                onNone: () => Effect.fail(new AgentModelOff()),
                onSome: (server) => Effect.succeed(Option.some(server)),
              }),
            onSome: (own) =>
              models.own(own).pipe(
                Effect.map(Option.some),
                Effect.orElseSucceed(() => Option.none())
              ),
          }),
      });

      const source = Option.match(lease, {
        onNone: () => "workspace" as const,
        onSome: (opened) => opened.source,
      });

      let history = yield* historyOf(chat.history);
      const { lastAnswer } = chat;

      // A continuation goes on in the answer that asked; a message starts
      // one.
      const continuing = input._tag === "answer" ? lastAnswer : Option.none();

      // After an answer, the model is asked again only once nothing else
      // of its round waits.
      const stillWaiting =
        input._tag === "answer"
          ? Option.match(lastAnswer, {
              onNone: () => [],
              onSome: (last) =>
                pendingOf(last).filter(({ callId }) => callId !== input.callId),
            })
          : [];

      const needsRound = Option.isSome(chosen) && stillWaiting.length === 0;

      // The first round's request, claimed before any event: a refusal
      // answers the request itself.
      const firstClaim: Option.Option<RoundClaim> =
        needsRound && Option.isSome(lease)
          ? Option.some(
              yield* lease.value.claim.pipe(
                Effect.catchTags({
                  AssistantQuotaExceeded: ({ dailyLimit, resetsAt }) =>
                    Effect.fail(
                      new DayExhausted({
                        dailyLimit,
                        resetsAt,
                        source: "server",
                      })
                    ),
                  OwnTextExhausted: ({ dailyLimit, resetsAt }) =>
                    Effect.fail(
                      new DayExhausted({
                        dailyLimit,
                        resetsAt,
                        source: "workspace",
                      })
                    ),
                })
              )
            )
          : Option.none();

      // Each round's request after the first, claimed before it is sent.
      const nextClaim = (index: number) =>
        index === 0 && Option.isSome(firstClaim)
          ? Effect.succeed(firstClaim.value)
          : Option.match(lease, {
              onNone: () =>
                Effect.fail(new RunEnded({ reason: "providerRefused" })),
              onSome: ({ claim }) =>
                claim.pipe(
                  Effect.mapError(
                    () => new RunEnded({ reason: "allowanceReached" })
                  )
                ),
            });

      const startedAt = yield* Clock.currentTimeMillis;

      // The person's message first, so a chat's messages, ordered by
      // their ids, read in the order they were written.
      const userMessageId =
        input._tag === "message"
          ? Option.some(
              yield* newId(AgentMessageIdSchema).pipe(
                Effect.provideService(Ids, ids)
              )
            )
          : Option.none();

      const answerId = Option.isSome(continuing)
        ? continuing.value.id
        : yield* newId(AgentMessageIdSchema).pipe(
            Effect.provideService(Ids, ids)
          );

      const answerCreatedAt = Option.isSome(continuing)
        ? continuing.value.createdAt
        : yield* DateTime.now;

      const priorDuration = Option.isSome(continuing)
        ? Option.getOrElse(continuing.value.durationMs, () => 0)
        : 0;

      const run = (queue: Queue.Queue<AgentEvent, Cause.Done>) =>
        Effect.gen(function* running() {
          const draft = yield* Ref.make<AnswerDraft>(
            Option.match(continuing, {
              onNone: () => emptyAnswer,
              onSome: ({ approvals, cards, steps, text }) => ({
                approvals,
                cards,
                steps,
                text,
              }),
            })
          );

          // Every event goes to the person and into the answer.
          const emit = (event: AgentEvent) =>
            Ref.update(draft, (current) => applied(current, event)).pipe(
              Effect.andThen(Queue.offer(queue, event))
            );

          // A step, where it falls in the answer: where it was first
          // called, or the answer's length now.
          const stepOf = (
            callId: string,
            state: AgentStepState,
            tool: string
          ) =>
            Ref.get(draft).pipe(
              Effect.map(({ steps, text }) => ({
                at:
                  steps.find((step) => step.callId === callId)?.at ??
                  text.length,
                callId,
                state,
                tool,
              }))
            );

          const rounds = yield* Ref.make(0);
          const toolsCalled = yield* Ref.make<readonly string[]>([]);

          const answerAs = (outcome: AgentOutcome) =>
            Effect.gen(function* answerWritten() {
              const written = yield* Ref.get(draft);
              const tookMs = yield* millisSince(startedAt);

              return new AgentMessage({
                approvals: written.approvals,
                cards: written.cards,
                createdAt: answerCreatedAt,
                durationMs: Option.some(priorDuration + tookMs),
                id: answerId,
                outcome: Option.some(outcome),
                rating: Option.none(),
                role: "assistant",
                steps: written.steps,
                text: storableText(written.text, maxAnswerLength),
              });
            });

          const keep = (outcome: AgentOutcome) =>
            Effect.gen(function* kept() {
              const message = yield* answerAs(outcome);

              yield* chats.save(
                chat.chat.id,
                message,
                yield* storedHistory(history),
                yield* DateTime.now
              );

              return message;
            });

          const told = (outcome: string) =>
            Effect.gen(function* logged() {
              yield* Effect.annotateCurrentSpan({
                "peal.agent.outcome": outcome,
                "peal.agent.rounds": yield* Ref.get(rounds),
                "peal.agent.source": source,
              });
              yield* Effect.logInfo("The agent ran", {
                durationMs: yield* millisSince(startedAt),
                outcome,
                rounds: yield* Ref.get(rounds),
                source,
                tools: yield* Ref.get(toolsCalled),
              });
            });

          // A call that ran: its step, its card, its record.
          const ranCall = (
            result: CallResult,
            approval: Option.Option<AgentApproval>
          ) =>
            Effect.gen(function* ran() {
              yield* Ref.update(toolsCalled, (called) => [
                ...called,
                result.tool,
              ]);

              yield* emit({
                _tag: "step",
                step: yield* stepOf(
                  result.callId,
                  stateOf(result.isFailure, result.encoded),
                  result.tool
                ),
              });

              if (!result.isFailure) {
                const card = cardOf(
                  result.tool,
                  result.encoded,
                  approval,
                  yield* DateTime.now
                );

                if (Option.isSome(card)) {
                  yield* emit({ _tag: "card", card: card.value });
                }
              }

              if (toolbox.changes(result.tool)) {
                yield* toolbox.record({
                  member,
                  origin,
                  refused: result.isFailure,
                  tool: result.tool,
                });
              }
            });

          // One round: the model's answer streamed, the tools it calls run,
          // those that wait for the person turned into approvals.
          const roundOf = (model: LanguageModel.LanguageModel) =>
            Effect.gen(function* streamed() {
              const now = yield* DateTime.now;
              let text = "";
              const calls: MadeCall[] = [];
              const results: CallResult[] = [];
              const waiting: AgentApproval[] = [];

              const onPart = (
                part: Response.StreamPart<Record<string, AgentTool>, "opaque">
              ) =>
                Effect.gen(function* read() {
                  if (part.type === "text-delta") {
                    text = `${text}${part.delta}`;
                    yield* emit({ _tag: "text", delta: part.delta });
                  } else if (
                    part.type === "tool-call" &&
                    !part.providerExecuted
                  ) {
                    calls.push({
                      callId: part.id,
                      params: yield* asJson(part.params),
                      tool: part.name,
                    });

                    if (!asking.has(part.name)) {
                      yield* emit({
                        _tag: "step",
                        step: yield* stepOf(part.id, "running", part.name),
                      });
                    }
                  } else if (part.type === "tool-result" && !part.preliminary) {
                    const result: CallResult = {
                      callId: part.id,
                      encoded: yield* asJson(part.encodedResult),
                      isFailure: part.isFailure,
                      tool: part.name,
                    };

                    results.push(result);
                    yield* ranCall(result, Option.none());
                  } else if (part.type === "tool-approval-request") {
                    const call = calls.find(
                      ({ callId }) => callId === part.toolCallId
                    );

                    if (call !== undefined) {
                      const approval = approvalOf(
                        call,
                        yield* postNamed(member, call.params),
                        yield* toolbox.subjectOf(member, call.tool, call.params)
                      );

                      waiting.push(approval);
                      yield* emit({ _tag: "approval", approval });
                    }
                  }
                });

              yield* model
                .streamText({
                  concurrency: 1,
                  prompt: Prompt.concat(
                    Prompt.fromMessages([
                      Prompt.systemMessage({
                        content: agentInstructions(now, timeZone),
                        options: cachedPrefix,
                      }),
                    ]),
                    history
                  ),
                  toolCallValidation: "deferred",
                  toolkit: toolbox.toolkit,
                })
                .pipe(
                  Stream.runForEach(onPart),
                  Effect.provideService(CurrentMember, member),
                  // effect/ai's spans record prompts, answers and errors.
                  Effect.withTracerEnabled(false),
                  Effect.mapError(roundFailure),
                  Effect.timeoutOrElse({
                    duration: roundTimeout,
                    orElse: () =>
                      Effect.fail(new RunEnded({ reason: "timedOut" })),
                  })
                );

              const outcome: RoundOutcome = {
                approvals: waiting,
                calls,
                results,
                text,
              };

              return outcome;
            });

          // The round, its request claimed first: given back when the
          // provider never ran it, forgiven when it failed once it had it.
          const claimedRound = (
            model: LanguageModel.LanguageModel,
            claim: RoundClaim
          ) =>
            Effect.uninterruptibleMask((restore) =>
              restore(roundOf(model)).pipe(
                Effect.onExit((exit) => {
                  if (Exit.isSuccess(exit)) {
                    return Effect.void;
                  }

                  return runFailureOf(exit.cause) === "unreachable"
                    ? claim.unsent
                    : claim.failed;
                })
              )
            );

          // The model's rounds, until it answers without calling a tool, a
          // call waits for the person, or the run took as many as it may.
          const modelRounds = (model: LanguageModel.LanguageModel) =>
            Effect.gen(function* rounding() {
              for (let index = 0; index < maxRounds; index += 1) {
                const claim = yield* nextClaim(index);
                const completed = yield* claimedRound(model, claim);

                yield* Ref.update(rounds, (count) => count + 1);
                history = withRound(
                  history,
                  completed.text,
                  completed.calls,
                  completed.results
                );

                if (completed.approvals.length > 0) {
                  return "awaitingApproval" as const;
                }

                if (completed.calls.length === 0) {
                  return "answered" as const;
                }
              }

              return "stepLimit" as const;
            });

          // The chat's name, after its first answer: the model's few words,
          // else the person's first ones.
          const named = (model: LanguageModel.LanguageModel, first: string) =>
            Option.isSome(chat.chat.title)
              ? Effect.void
              : model
                  .generateObject({
                    objectName: "title",
                    prompt: Prompt.fromMessages([
                      Prompt.systemMessage({ content: titleInstructions }),
                      Prompt.userMessage({
                        content: [
                          Prompt.textPart({
                            text: JSON.stringify({ message: first }),
                          }),
                        ],
                      }),
                    ]),
                    schema: TitleAnswerSchema,
                  })
                  .pipe(
                    Effect.withTracerEnabled(false),
                    Effect.timeout(titleTimeout),
                    Effect.map(({ value }) => acceptedTitle(value)),
                    Effect.orElseSucceed(() => Option.none<string>()),
                    Effect.map(Option.getOrElse(() => fallbackTitle(first))),
                    Effect.tap((title) => chats.name(chat.chat.id, title)),
                    Effect.flatMap((title) => emit({ _tag: "title", title }))
                  );

          // The person's message: the changes that still waited are not
          // made (the model reads so, the person sees them expire), and
          // the message is kept.
          const messageTaken = (text: string, userId: AgentMessage["id"]) =>
            Effect.gen(function* taken() {
              const expired = Option.match(lastAnswer, {
                onNone: () => [],
                onSome: pendingOf,
              });

              if (expired.length > 0 && Option.isSome(lastAnswer)) {
                history = withResults(
                  history,
                  unansweredCalls(history)
                    .filter(({ callId }) =>
                      expired.some((approval) => approval.callId === callId)
                    )
                    .map((call): CallResult => ({
                      callId: call.callId,
                      encoded: notMade.expired,
                      isFailure: true,
                      tool: call.tool,
                    }))
                );

                const before = lastAnswer.value;
                let { approvals } = before;

                for (const approval of expired) {
                  approvals = answered(approvals, approval.callId, "expired");
                  yield* Queue.offer(queue, {
                    _tag: "approval",
                    approval: { ...approval, state: "expired" },
                  });
                }

                yield* chats.save(
                  chat.chat.id,
                  new AgentMessage({
                    approvals,
                    cards: before.cards,
                    createdAt: before.createdAt,
                    durationMs: before.durationMs,
                    id: before.id,
                    outcome: before.outcome,
                    rating: before.rating,
                    role: before.role,
                    steps: before.steps,
                    text: before.text,
                  }),
                  yield* storedHistory(history),
                  yield* DateTime.now
                );
              }

              history = withUserMessage(history, text);

              yield* chats.save(
                chat.chat.id,
                new AgentMessage({
                  approvals: [],
                  cards: [],
                  createdAt: yield* DateTime.now,
                  durationMs: Option.none(),
                  id: userId,
                  outcome: Option.none(),
                  rating: Option.none(),
                  role: "user",
                  steps: [],
                  text: storableText(text, maxAnswerLength),
                }),
                yield* storedHistory(history),
                yield* DateTime.now
              );
            });

          // The person's answer to a change: made, with their permissions
          // as they are now, or not, and the model reads which.
          const answerTaken = (callId: string, approved: boolean) =>
            Effect.gen(function* taken() {
              const asked = lastAnswer.pipe(
                Option.flatMap((last) =>
                  Option.fromUndefinedOr(
                    last.approvals.find(
                      (approval) => approval.callId === callId
                    )
                  )
                )
              );

              const call = unansweredCalls(history).find(
                (made) => made.callId === callId
              );

              const state = approved ? "approved" : "declined";

              if (Option.isSome(asked)) {
                yield* emit({
                  _tag: "approval",
                  approval: { ...asked.value, state },
                });
              }

              if (call !== undefined && approved) {
                yield* emit({
                  _tag: "step",
                  step: yield* stepOf(callId, "running", call.tool),
                });

                const result = yield* runApproved(member, call);

                history = withResults(history, [result]);
                yield* ranCall(
                  result,
                  asked.pipe(Option.map((approval) => ({ ...approval, state })))
                );
              }

              if (call !== undefined && !approved) {
                history = withResults(history, [
                  {
                    callId,
                    encoded: notMade.declined,
                    isFailure: true,
                    tool: call.tool,
                  },
                ]);
              }
            });

          const everything = Effect.gen(function* answering() {
            yield* emit({
              _tag: "started",
              messageId: answerId,
              userMessageId: Option.getOrNull(userMessageId),
            });

            if (input._tag === "message" && Option.isSome(userMessageId)) {
              yield* messageTaken(input.text, userMessageId.value);
            }

            if (input._tag === "answer") {
              yield* answerTaken(input.callId, input.approved);

              if (stillWaiting.length > 0) {
                return "awaitingApproval" as const;
              }
            }

            if (Option.isNone(chosen)) {
              return yield* new RunEnded({ reason: "providerRefused" });
            }

            const outcome = yield* modelRounds(chosen.value);

            if (input._tag === "message") {
              yield* named(chosen.value, input.text);
            }

            return outcome;
          });

          const finish = (outcome: AgentOutcome) =>
            Effect.gen(function* finishing() {
              const message = yield* keep(outcome);

              yield* told(outcome);
              yield* Queue.offer(queue, {
                _tag: "finished",
                durationMs: Option.getOrElse(message.durationMs, () => 0),
                outcome,
              });
            });

          const fail = (reason: AgentFailure) =>
            Effect.gen(function* failing() {
              yield* keep("failed");
              yield* told(reason);
              yield* Queue.offer(queue, { _tag: "failed", reason });
            });

          yield* everything.pipe(
            Effect.timeoutOrElse({
              duration: runTimeout,
              orElse: () => Effect.fail(new RunEnded({ reason: "timedOut" })),
            }),
            Effect.matchCauseEffect({
              onFailure: (cause) =>
                Cause.hasInterruptsOnly(cause)
                  ? Effect.void
                  : fail(runFailureOf(cause)),
              onSuccess: finish,
            }),
            // Stopped: what was written is kept.
            Effect.onInterrupt(() =>
              keep("stopped").pipe(
                Effect.andThen(told("stopped")),
                Effect.orDie
              )
            ),
            Effect.andThen(Queue.end(queue))
          );
        }).pipe(Effect.withSpan("AgentRuns.run"));

      return Stream.callback<AgentEvent>(run);
    });

    return AgentRuns.of({ availability, start });
  })
);
