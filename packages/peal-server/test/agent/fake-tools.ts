import { Context, Effect, Layer, Option, Ref, Schema, Semaphore } from "effect";
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
    "queue_post",
    Schema.Struct({
      postId: Schema.String,
      queue: Schema.optionalKey(Schema.String),
    }),
    true
  ),
  tool("list_queues", Schema.Struct({})),
  tool(
    "preview_queue",
    Schema.Struct({ count: Schema.Int, queueId: Schema.String })
  ),
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
    /**
     * A teammate edits the post's text the next time the post is read,
     * as soon as nothing holds it: an edit that lands between the
     * agent's reading of the post and the change it runs, unless the
     * post is held between them.
     */
    readonly editWhenRead: (text: string) => Effect.Effect<void>;
    /** The text the post had each time it was published. */
    readonly published: Effect.Effect<readonly string[]>;
  }
>()("peal-server/test/agent/FakeTools") {}

export const FakeToolboxLive = Layer.effectContext(
  Effect.gen(function* FakeToolboxLive() {
    const ran = yield* Ref.make<readonly string[]>([]);
    const records = yield* Ref.make<readonly ToolCallRecord[]>([]);
    const text = yield* Ref.make(postText);
    const published = yield* Ref.make<readonly string[]>([]);
    const pendingEdit = yield* Ref.make(Option.none<string>());
    // The post's lock, as a change of the post takes it.
    const lock = yield* Semaphore.make(1);

    const edited = (changed: string) =>
      lock.withPermits(1)(Ref.set(text, changed));

    // An edit asked to land when the post is read: started at once, and
    // given the time to land unless the post is held.
    const editsOnRead = Ref.getAndSet(pendingEdit, Option.none()).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (changed) =>
            Effect.forkDetach(edited(changed)).pipe(
              Effect.andThen(
                Effect.forEach(
                  Array.from({ length: 10 }),
                  () => Effect.yieldNow
                )
              ),
              Effect.asVoid
            ),
        })
      )
    );

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
                    ? held("draft").pipe(Effect.tap(() => editsOnRead))
                    : Effect.fail(
                        new ToolRefused({ message: "No post with this id." })
                      )
                )
              )
            ),
          list_posts: () =>
            running("list_posts", Effect.succeed({ posts: [] })),
          // The workspace's one queue, its default, of the post's channel.
          list_queues: () =>
            running(
              "list_queues",
              Effect.succeed({
                queues: [
                  {
                    channelIds: [channelId],
                    channelSetId: null,
                    id: "queue-1",
                    isDefault: true,
                    name: "Mornings",
                  },
                ],
              })
            ),
          preview_queue: () =>
            running(
              "preview_queue",
              Effect.succeed({
                nextFree: "2026-12-02T08:00:00.000Z",
                noRoom: null,
                slots: [],
              })
            ),
          queue_post: () =>
            running(
              "queue_post",
              held("scheduled", "2026-12-02T08:00:00.000Z")
            ),
          moderate_comment: () =>
            running(
              "moderate_comment",
              Effect.succeed({ text: "Spam here", threadId: "thread-1" })
            ),
          publish_post: () =>
            running(
              "publish_post",
              Ref.get(text).pipe(
                Effect.tap((now) =>
                  Ref.update(published, (texts) => [...texts, now])
                ),
                Effect.andThen(held("publishing"))
              )
            ),
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
        // The post held while the effect runs, as the live toolbox's
        // transaction does.
        holdingPost: (_member, named) => (effect) =>
          Option.isSome(named) ? lock.withPermits(1)(effect) : effect,
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
          edit: edited,
          editWhenRead: (changed) => Ref.set(pendingEdit, Option.some(changed)),
          published: Ref.get(published),
          ran: Ref.get(ran),
          records: Ref.get(records),
        })
      )
    );
  })
);
