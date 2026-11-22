import { Effect, flow, Layer, Option, Schema, Stream } from "effect";
import { LanguageModel, Tool, Toolkit } from "effect/ai";
import { CurrentMember } from "peal-contract";
import type { Member } from "peal-contract";

import { quoted } from "#agent/domain/agent-approvals.ts";
import type { CallSubject } from "#agent/domain/agent-approvals.ts";
import {
  agentToolNames,
  approvedTools,
  draftFreeTools,
} from "#agent/domain/agent-toolset.ts";
import type { AgentToolName } from "#agent/domain/agent-toolset.ts";
import {
  advertisedObject,
  JsonObjectSchema,
} from "#agent/infrastructure/advertised-schema.ts";
import { AgentToolbox } from "#agent/infrastructure/agent-toolbox.ts";
import type { AgentTool } from "#agent/infrastructure/agent-toolbox.ts";
import { PealToolsLive } from "#app/mcp/handlers.ts";
import { toolRefusedCode } from "#app/mcp/recorded-calls.ts";
import { changingTools, contentTools } from "#app/mcp/server.ts";
import { ToolRefused } from "#app/mcp/tool-refused.ts";
import { PealTools } from "#app/mcp/tools.ts";
import { EngagementInbox } from "#engagement/application/engagement-inbox.ts";
import { EngagementReviews } from "#engagement/application/engagement-reviews.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { ReviewIdSchema } from "#engagement/domain/review-id.ts";
import { actorOf } from "#shared/api/actor.ts";
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

const decodeCommentNamed = Schema.decodeUnknownOption(
  Schema.Struct({ commentId: CommentIdSchema })
);

const decodeReviewNamed = Schema.decodeUnknownOption(
  Schema.Struct({ reviewId: ReviewIdSchema })
);

// The tools whose call names a comment, and the one that names a review.
const commentTools: ReadonlySet<string> = new Set([
  "mark_comment_answered",
  "moderate_comment",
  "reply_to_comment",
]);

const reviewTool = "reply_to_location_review";

const decodeJsonObject = Schema.decodeUnknownSync(JsonObjectSchema);

/**
 * The JSON Schema the agent advertises a tool's parameters with: the one
 * a provider would be sent for the MCP tool itself, outside strict mode,
 * without what Anthropic refuses (`advertised-schema.ts`).
 */
export const advertisedParameters = (name: AgentToolName) =>
  advertisedObject(
    decodeJsonObject(
      Tool.getJsonSchemaFromSchema(PealTools.tools[name].parametersSchema, {
        transformer: LanguageModel.defaultCodecTransformer,
      })
    )
  );

/**
 * The MCP endpoint's tool of that name, as the agent calls it: its name
 * and description, its parameters advertised as `advertisedParameters`
 * says and handed over as the model sent them, for the MCP tool's own
 * codec to decode (a call it refuses is refused to the model), its
 * refusals returned to the model instead of failing the run, the
 * person's approval asked first when `needsApproval` says so, and not
 * strict: no provider rewrites its schema into a strict subset. Every
 * name of the agent's toolset is one of the endpoint's tools, which the
 * types check.
 */
export const agentToolOf = (
  name: AgentToolName,
  needsApproval?: Tool.NeedsApproval<Schema.Top>
): AgentTool => {
  const tool = PealTools.tools[name];

  return Tool.dynamic(tool.name, {
    description: tool.description,
    failure: ToolRefused,
    failureMode: "return",
    needsApproval,
    parameters: advertisedParameters(name),
    success: Schema.Json,
  }).annotate(Tool.Strict, false);
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

const isRefusal = Schema.is(ToolRefused);

// What the model is told of parameters the MCP tool's codec refused.
const parametersRefused = new ToolRefused({
  message:
    "This tool takes other parameters: read its schema and call it again with the ones it describes.",
});

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
    const inbox = yield* EngagementInbox;
    const reviews = yield* EngagementReviews;

    // The comment or review a call names, read as the member may read it.
    const subjectOf = (
      member: Member,
      tool: string,
      params: Schema.Json
    ): Effect.Effect<Option.Option<CallSubject>> => {
      const actor = actorOf(member);

      const comment = commentTools.has(tool)
        ? decodeCommentNamed(params)
        : Option.none();

      const review =
        tool === reviewTool ? decodeReviewNamed(params) : Option.none();

      if (Option.isSome(comment)) {
        return inbox.comment(actor, comment.value.commentId).pipe(
          Effect.map(
            Option.map((found): CallSubject => ({
              inReplyTo: quoted(
                Option.match(found.author, {
                  onNone: () => "",
                  onSome: ({ displayName, handle }) =>
                    Option.getOrElse(displayName, () => handle),
                }),
                found.text
              ),
              threadId: found.threadId,
            }))
          ),
          Effect.withTracerEnabled(false),
          Effect.orElseSucceed(() => Option.none())
        );
      }

      if (Option.isSome(review)) {
        return reviews.review(actor, review.value.reviewId).pipe(
          Effect.map(
            Option.map((found): CallSubject => ({
              inReplyTo: quoted(
                Option.getOrElse(found.reviewerName, () => ""),
                found.text
              ),
              threadId: found.threadId,
            }))
          ),
          Effect.withTracerEnabled(false),
          Effect.orElseSucceed(() => Option.none())
        );
      }

      return Effect.succeedNone;
    };

    // A tool's call, answered by the MCP endpoint's handler: its answer,
    // or the refusal it answered, which the agent's tool returns to the
    // model.
    // The model's parameters go as it sent them, as JSON, and the MCP
    // tool's own codec decodes them; its answer comes back as JSON.
    const handled = (name: AgentToolName) =>
      flow(
        (params: Tool.Parameters<AgentTool>) => decodeJson(params),
        Effect.mapError(() => parametersRefused),
        Effect.flatMap((json) => peal.handle(name, json)),
        Effect.flatMap(Stream.runLast),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.die(`The tool ${name} answered nothing`),
            onSome: ({ encodedResult, isFailure, result }) => {
              if (!isFailure) {
                return decodeJson(encodedResult).pipe(Effect.orDie);
              }

              return Effect.fail(
                isRefusal(result) ? result : parametersRefused
              );
            },
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
      subjectOf,
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
