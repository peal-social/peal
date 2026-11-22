import { Context, Effect, Layer, Option, Ref, Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { CurrentMember } from "peal-contract";

import { AgentToolbox } from "#agent/infrastructure/agent-toolbox.ts";
import type {
  AgentTool,
  ToolCallRecord,
} from "#agent/infrastructure/agent-toolbox.ts";
import { ToolRefused } from "#app/mcp/tool-refused.ts";

/** A post, as the post tools answer it. */
const PostView = Schema.Struct({
  content: Schema.Struct({ text: Schema.String }),
  id: Schema.String,
  schedule: Schema.NullOr(
    Schema.Struct({ at: Schema.String, timeZone: Schema.String })
  ),
  status: Schema.String,
  targets: Schema.Array(Schema.Struct({ channelId: Schema.String })),
});

const tool = (
  name: string,
  parameters: Schema.Top & {
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
  needsApproval?: boolean
): AgentTool =>
  Tool.make(name, {
    dependencies: [CurrentMember],
    failure: ToolRefused,
    failureMode: "return",
    needsApproval,
    parameters,
    success: Schema.Json,
  });

/** The post every fake tool answers about. */
export const postId = "0190f0e0-0000-7000-8000-00000000a001";

const post = (status: string, at: string | null) =>
  Schema.encodeSync(PostView)({
    content: { text: "Our spring launch is here." },
    id: postId,
    schedule: at === null ? null : { at, timeZone: "Europe/Paris" },
    status,
    targets: [{ channelId: "0190f0e0-0000-7000-8000-00000000c001" }],
  });

/**
 * A few of the MCP endpoint's tools, as the agent's toolset names them,
 * with handlers that answer what the test needs and keep who called them.
 */
const FakeToolkit = Toolkit.make(
  tool("list_posts", Schema.Struct({})),
  tool("get_post", Schema.Struct({ postId: Schema.String })),
  tool(
    "create_draft",
    Schema.Struct({ content: Schema.Struct({ text: Schema.String }) })
  ),
  tool(
    "schedule_post",
    Schema.Struct({ at: Schema.String, postId: Schema.String }),
    true
  ),
  tool(
    "reply_to_comment",
    Schema.Struct({ commentId: Schema.String, text: Schema.String }),
    true
  )
);

/** What the fake tools did, and what the records kept. */
export class FakeTools extends Context.Service<
  FakeTools,
  {
    readonly ran: Effect.Effect<readonly string[]>;
    readonly records: Effect.Effect<readonly ToolCallRecord[]>;
  }
>()("peal-server/test/agent/FakeTools") {}

export const FakeToolboxLive = Layer.effectContext(
  Effect.gen(function* FakeToolboxLive() {
    const ran = yield* Ref.make<readonly string[]>([]);
    const records = yield* Ref.make<readonly ToolCallRecord[]>([]);

    const running = (
      name: string,
      answer: Effect.Effect<Schema.Json, ToolRefused>
    ) =>
      Ref.update(ran, (names) => [...names, name]).pipe(Effect.andThen(answer));

    const toolkit = yield* FakeToolkit.pipe(
      Effect.provide(
        FakeToolkit.toLayer({
          create_draft: () =>
            running("create_draft", Effect.succeed(post("draft", null))),
          get_post: (params) =>
            running(
              "get_post",
              Schema.decodeUnknownEffect(
                Schema.Struct({ postId: Schema.String })
              )(params).pipe(
                Effect.orDie,
                Effect.flatMap(({ postId: asked }) =>
                  asked === postId
                    ? Effect.succeed(post("draft", null))
                    : Effect.fail(
                        new ToolRefused({ message: "No post with this id." })
                      )
                )
              )
            ),
          list_posts: () =>
            running("list_posts", Effect.succeed({ posts: [] })),
          reply_to_comment: () =>
            running(
              "reply_to_comment",
              Effect.succeed({ text: "Thank you!", threadId: "thread-1" })
            ),
          schedule_post: () =>
            running(
              "schedule_post",
              Effect.succeed(post("scheduled", "2026-12-01T08:00:00.000Z"))
            ),
        })
      )
    );

    return Context.make(
      AgentToolbox,
      AgentToolbox.of({
        changes: (name) => name !== "list_posts" && name !== "get_post",
        // The comment every reply answers, as the inbox holds it.
        subjectOf: (_member, name) =>
          Effect.succeed(
            name === "reply_to_comment"
              ? Option.some({
                  inReplyTo: { author: "Ada", text: "Love the new colours!" },
                  threadId: "thread-1",
                })
              : Option.none()
          ),
        record: (call) => Ref.update(records, (kept) => [...kept, call]),
        toolkit,
      })
    ).pipe(
      Context.add(
        FakeTools,
        FakeTools.of({ ran: Ref.get(ran), records: Ref.get(records) })
      )
    );
  })
);
