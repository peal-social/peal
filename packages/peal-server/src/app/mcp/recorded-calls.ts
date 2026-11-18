import { Clock, Effect, Exit, Option, Schema } from "effect";
import { McpServer } from "effect/ai";
import { CurrentMember } from "peal-contract";
import type { Member } from "peal-contract";

import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { ToolErrorTypeSchema } from "#shared/domain/product-event.ts";
import { recordToolCall } from "#workspace/api/activity-recording.ts";
import { capturedActorOf } from "#workspace/api/principal.ts";
import { ActivityJournal } from "#workspace/application/activity-journal.ts";

const decodeErrorType = Schema.decodeUnknownOption(ToolErrorTypeSchema);

// What a tool answered, as the MCP server hands it on: an error or not.
const decodeAnswer = Schema.decodeUnknownOption(
  Schema.Struct({ isError: Schema.Boolean })
);

/** The code the log keeps for a tool that answered an error. */
export const toolRefusedCode = "tool_refused";

/** The code the log keeps for a call the MCP server itself failed. */
export const toolFailedCode = "tool_failed";

// How a call that ran ended: nothing when the tool did what was asked.
const errorCodeOf = (
  exit: Exit.Exit<unknown, unknown>
): Option.Option<string> =>
  Exit.match(exit, {
    onFailure: () => Option.some(toolFailedCode),
    onSuccess: (answer) =>
      decodeAnswer(answer).pipe(
        Option.filter(({ isError }) => isError),
        Option.as(toolRefusedCode)
      ),
  });

/**
 * Keeps each call of a tool that changes something in the workspace's
 * activity log (ActivityJournal), by the tool's name, once the tool has
 * run, with how it ended: nothing when it did what was asked,
 * `tool_refused` when it answered an error (a permission the connection
 * lacks, a plan's limit, something not found), `tool_failed` when the
 * call ended without an answer. It runs around the tool itself, so a
 * request the endpoint refused before any tool ran (a batch, a session it
 * does not know, a method it does not serve) keeps nothing, however many
 * calls its body names.
 */
export const recordedCalls = (changingTools: ReadonlySet<string>) =>
  McpServer.middleware()(
    Effect.gen(function* recording() {
      const activity = yield* ActivityJournal;
      const analytics = yield* ProductAnalytics;

      // Every call that ran, reading or changing, for product analytics:
      // its name, how it ended and how long it took. Never what it was
      // asked or answered.
      const told = (
        member: Member,
        target: string,
        errorCode: Option.Option<string>,
        startedAt: number
      ) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((endedAt) =>
            analytics.capture({
              actor: capturedActorOf(member),
              billingAccountId: Option.none(),
              event: {
                name: "mcp_tool_called",
                properties: {
                  ...Option.match(
                    errorCode.pipe(Option.flatMap(decodeErrorType)),
                    {
                      onNone: () => ({}),
                      onSome: (errorType) => ({ errorType }),
                    }
                  ),
                  changes: changingTools.has(target),
                  durationMs: Math.max(0, Math.round(endedAt - startedAt)),
                  isError: Option.isSome(errorCode),
                  tool: target,
                },
              },
              workspaceId: Option.some(
                WorkspaceIdSchema.make(member.workspaceId)
              ),
            })
          )
        );

      return (effect, { method, target }) =>
        method === "tools/call"
          ? Clock.currentTimeMillis.pipe(
              Effect.flatMap((startedAt) =>
                effect.pipe(
                  Effect.onExit((exit) =>
                    CurrentMember.pipe(
                      Effect.flatMap((member) => {
                        const errorCode = errorCodeOf(exit);

                        return (
                          changingTools.has(target)
                            ? recordToolCall(activity, {
                                errorCode: Option.getOrUndefined(errorCode),
                                member,
                                tool: target,
                              })
                            : Effect.void
                        ).pipe(
                          Effect.andThen(
                            told(member, target, errorCode, startedAt)
                          )
                        );
                      })
                    )
                  )
                )
              )
            )
          : effect;
    })
  ).layer;
