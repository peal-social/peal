import { Effect, flow, Layer, Option, Schema, Stream } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { CurrentMember } from "peal-contract";

import {
  agentToolNames,
  approvedTools,
  draftFreeTools,
} from "#agent/domain/agent-toolset.ts";
import type { AgentToolName } from "#agent/domain/agent-toolset.ts";
import { AgentToolbox } from "#agent/infrastructure/agent-toolbox.ts";
import type { AgentTool } from "#agent/infrastructure/agent-toolbox.ts";
import { PealToolsLive } from "#app/mcp/handlers.ts";
import { toolRefusedCode } from "#app/mcp/recorded-calls.ts";
import { changingTools, contentTools } from "#app/mcp/server.ts";
import { PealTools } from "#app/mcp/tools.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { recordToolCall } from "#workspace/api/activity-recording.ts";
import { ActivityJournal } from "#workspace/application/activity-journal.ts";
import { ConnectionJournal } from "#workspace/application/connection-journal.ts";

const approved: ReadonlySet<string> = new Set(approvedTools);

const draftFree: ReadonlySet<string> = new Set(draftFreeTools);

const isDraft = Schema.is(Schema.Struct({ status: Schema.Literal("draft") }));

const decodePostNamed = Schema.decodeUnknownOption(
  Schema.Struct({ postId: Schema.String })
);

/**
 * The MCP endpoint's tool of that name, as the agent calls it: its name,
 * description and schemas, so the MCP handlers answer it, its refusals
 * returned to the model instead of failing the run, and the person's
 * approval asked first when `needsApproval` says so. Every name of the
 * agent's toolset is one of the endpoint's tools, which the types check.
 */
export const agentToolOf = (
  name: AgentToolName,
  needsApproval?: Tool.NeedsApproval<Schema.Top>
): AgentTool => {
  const tool = PealTools.tools[name];

  return Tool.make(tool.name, {
    dependencies: [CurrentMember],
    description: tool.description,
    failure: tool.failureSchema,
    failureMode: "return",
    needsApproval,
    parameters: tool.parametersSchema,
    success: tool.successSchema,
  });
};

/** The post a call names, by its parameters. */
type NamedPost = Option.Option<{ readonly postId: string }>;

// Whether a tool asks first: always, never, or unless the post it names
// is a draft.
const askingOf = (
  name: AgentToolName,
  unlessDraft: Tool.NeedsApproval<Schema.Top>
): Tool.NeedsApproval<Schema.Top> | undefined => {
  if (approved.has(name)) {
    return true;
  }

  return draftFree.has(name) ? unlessDraft : undefined;
};

// The agent's toolkit, each of its tools asking first where the agent's
// toolset says so.
export const agentToolkit = (
  isDraftPost: (named: NamedPost) => Effect.Effect<boolean>
) =>
  Toolkit.make(
    ...agentToolNames.map((name) =>
      agentToolOf(
        name,
        askingOf(name, (params) =>
          isDraftPost(decodePostNamed(params)).pipe(
            Effect.map((draft) => !draft)
          )
        )
      )
    )
  );

const decodeJson = Schema.decodeUnknownEffect(Schema.Json);

// A call's parameters, decoded by the agent's tool, as the MCP tool reads
// them: their JSON.
const encodedParameters = (name: AgentToolName) => {
  const encode = Schema.encodeUnknownEffect(
    Schema.toCodecJson(PealTools.tools[name].parametersSchema)
  );

  return (params: Tool.Parameters<AgentTool>) =>
    encode(params).pipe(Effect.flatMap(decodeJson));
};

/**
 * AgentToolbox on the MCP endpoint's handlers (PealToolsLive), which act
 * as the CurrentMember each call is given. A call that changes something
 * is kept in the workspace's activity log, as `agent.<tool>` through the
 * person's session, and, for a tool that changes content, its connection
 * in the ConnectionJournal once it did what was asked, as the API's and
 * the MCP endpoint's are.
 */
export const AgentToolboxLive = Layer.effect(
  AgentToolbox,
  Effect.gen(function* AgentToolboxLive() {
    const activity = yield* ActivityJournal;
    const connections = yield* ConnectionJournal;
    const peal = yield* PealTools;

    // A tool's call, answered by the MCP endpoint's handler: its answer,
    // or the refusal it answered, which the agent's tool returns to the
    // model.
    const handled = (name: AgentToolName) =>
      flow(
        encodedParameters(name),
        Effect.orDie,
        Effect.flatMap((json) => peal.handle(name, json)),
        Effect.flatMap(Stream.runLast),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.die(`The tool ${name} answered nothing`),
            onSome: ({ isFailure, result }) =>
              isFailure ? Effect.fail(result) : Effect.succeed(result),
          })
        )
      );

    // Whether the post a call names is a draft, as the person may read it:
    // anything else, a post they may not read included, asks first.
    const isDraftPost = (named: NamedPost) =>
      Effect.serviceOption(CurrentMember).pipe(
        Effect.flatMap((member) =>
          Option.match(Option.all({ member, named }), {
            onNone: () => Effect.succeed(false),
            onSome: ({ member: current, named: { postId } }) =>
              peal.handle("get_post", { postId }).pipe(
                Effect.flatMap(Stream.runLast),
                Effect.map((last) =>
                  Option.exists(
                    last,
                    ({ encodedResult, isFailure }) =>
                      !isFailure && isDraft(encodedResult)
                  )
                ),
                Effect.provideService(CurrentMember, current)
              ),
          })
        ),
        Effect.withTracerEnabled(false),
        Effect.orElseSucceed(() => false)
      );

    const kit = agentToolkit(isDraftPost);

    const toolkit = yield* kit.pipe(
      Effect.provide(
        kit.toLayer(
          Object.fromEntries(
            agentToolNames.map((name) => [name, handled(name)] as const)
          )
        )
      )
    );

    return AgentToolbox.of({
      changes: (tool) => changingTools.has(tool),
      record: ({ member, origin, refused, tool }) =>
        Effect.gen(function* record() {
          yield* recordToolCall(
            activity,
            {
              errorCode: refused ? toolRefusedCode : undefined,
              member,
              tool,
            },
            "agent"
          );

          if (refused || !contentTools.has(tool)) {
            return;
          }

          const { principal } = member;

          yield* connections
            .contentChanged({
              access: "session",
              apiKeyId: Option.none(),
              origin,
              userId:
                principal._tag === "user"
                  ? Option.some(UserIdSchema.make(principal.userId))
                  : Option.none(),
              workspaceId: Option.some(
                WorkspaceIdSchema.make(member.workspaceId)
              ),
            })
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logError(
                  "Keeping the connection that changed content failed",
                  cause
                )
              )
            );
        }),
      toolkit,
    });
  })
).pipe(Layer.provide(PealToolsLive));
