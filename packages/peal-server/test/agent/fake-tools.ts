import { Context, Effect, Layer, Option, Ref, Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { CurrentMember } from "peal-contract";

import { AgentToolbox } from "#agent/infrastructure/agent-toolbox.ts";
import type {
  AgentTool,
  ToolCallRecord,
} from "#agent/infrastructure/agent-toolbox.ts";
import { ToolRefused } from "#app/mcp/tool-refused.ts";

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

/** The one channel the post goes to. */
export const channelId = "0190f0e0-0000-7000-8000-00000000c001";

/** The post's text, until a test or a call changes it. */
export const postText = "Our spring launch is here.";

// A post as get_post answers it, all that goes out of it: a photo, a
// text of its own on its channel, a first comment, the platform's options.
const post = (
  status: string,
  at: string | null,
  text: string
): Schema.Json => ({
  content: {
    followUps: [
      {
        delaySeconds: 0,
        media: [],
        overrides: [],
        text: "Shop the launch: https://shop.example.com/spring",
      },
    ],
    media: [{ altText: "The new bottle", mediaId: "media-1" }],
    overrides: [{ channelId, text: `${text} Tag a friend who needs it.` }],
    text,
  },
  id: postId,
  schedule: at === null ? null : { at, timeZone: "Europe/Paris" },
  shortenLinks: false,
  status,
  tagIds: [],
  targets: [
    {
      channelId,
      id: "target-1",
      options: { collaborators: ["synthetic.partner"], platform: "instagram" },
    },
  ],
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
    "update_draft",
    Schema.Struct({
      content: Schema.Struct({ text: Schema.String }),
      postId: Schema.String,
    })
  ),
  tool(
    "schedule_post",
    Schema.Struct({ at: Schema.String, postId: Schema.String }),
    true
  ),
  tool("publish_post", Schema.Struct({ postId: Schema.String }), true),
  tool(
    "reply_to_comment",
    Schema.Struct({ commentId: Schema.String, text: Schema.String }),
    true
  ),
  tool(
    "moderate_comment",
    Schema.Struct({ action: Schema.String, commentId: Schema.String }),
    true
  )
);

/** What the fake tools did, and what the records kept. */
export class FakeTools extends Context.Service<
  FakeTools,
  {
    readonly ran: Effect.Effect<readonly string[]>;
    readonly records: Effect.Effect<readonly ToolCallRecord[]>;
    /** A teammate edits the post's text, as the workspace then holds it. */
    readonly edit: (text: string) => Effect.Effect<void>;
  }
>()("peal-server/test/agent/FakeTools") {}

export const FakeToolboxLive = Layer.effectContext(
  Effect.gen(function* FakeToolboxLive() {
    const ran = yield* Ref.make<readonly string[]>([]);
    const records = yield* Ref.make<readonly ToolCallRecord[]>([]);
    const text = yield* Ref.make(postText);

    const running = (
      name: string,
      answer: Effect.Effect<Schema.Json, ToolRefused>
    ) =>
      Ref.update(ran, (names) => [...names, name]).pipe(Effect.andThen(answer));

    const held = (status: string, at: string | null = null) =>
      Ref.get(text).pipe(Effect.map((now) => post(status, at, now)));

    const toolkit = yield* FakeToolkit.pipe(
      Effect.provide(
        FakeToolkit.toLayer({
          create_draft: () => running("create_draft", held("draft")),
          get_post: (params) =>
            running(
              "get_post",
              Schema.decodeUnknownEffect(
                Schema.Struct({ postId: Schema.String })
              )(params).pipe(
                Effect.orDie,
                Effect.flatMap(({ postId: asked }) =>
                  asked === postId
                    ? held("draft")
                    : Effect.fail(
                        new ToolRefused({ message: "No post with this id." })
                      )
                )
              )
            ),
          list_posts: () =>
            running("list_posts", Effect.succeed({ posts: [] })),
          moderate_comment: () =>
            running(
              "moderate_comment",
              Effect.succeed({ text: "Spam here", threadId: "thread-1" })
            ),
          publish_post: () => running("publish_post", held("publishing")),
          reply_to_comment: () =>
            running(
              "reply_to_comment",
              Effect.succeed({ text: "Thank you!", threadId: "thread-1" })
            ),
          schedule_post: () =>
            running(
              "schedule_post",
              held("scheduled", "2026-12-01T08:00:00.000Z")
            ),
          update_draft: (params) =>
            running(
              "update_draft",
              Schema.decodeUnknownEffect(
                Schema.Struct({
                  content: Schema.Struct({ text: Schema.String }),
                })
              )(params).pipe(
                Effect.orDie,
                Effect.tap(({ content }) => Ref.set(text, content.text)),
                Effect.andThen(held("draft"))
              )
            ),
        })
      )
    );

    return Context.make(
      AgentToolbox,
      AgentToolbox.of({
        changes: (name) => name !== "list_posts" && name !== "get_post",
        // The comment every reply or moderation acts on, as the inbox
        // holds it.
        subjectOf: (_member, name) =>
          Effect.succeed(
            name === "reply_to_comment" || name === "moderate_comment"
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
        FakeTools.of({
          edit: (changed) => Ref.set(text, changed),
          ran: Ref.get(ran),
          records: Ref.get(records),
        })
      )
    );
  })
);
