// Articles on a Hashnode publication: files uploaded then confirmed, the
// post in Markdown, a lost answer looked for among its latest posts,
// never sent twice; a publication without the Pro plan said so.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Option, Schema } from "effect";
import { TestClock } from "effect/testing";

import { ArticleStore } from "#articles/application/article-store.ts";
import { Articles } from "#articles/application/articles.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import {
  content,
  eventuallyLater,
  onArticles,
  stateOf,
  writer,
  zone,
} from "#test/articles/article-support.ts";
import {
  hashnodeChannel,
  sentToHashnode,
  startHashnode,
} from "#test/articles/hashnode-support.ts";
import { gardenBlog } from "#test/channels/fakes/fake-hashnode.ts";
import { freshWorkspace } from "#test/channels/support.ts";

const InputSchema = Schema.Struct({
  input: Schema.Struct({
    contentMarkdown: Schema.optionalKey(Schema.String),
    coverImage: Schema.optionalKey(Schema.NullOr(Schema.String)),
    publicationId: Schema.optionalKey(Schema.String),
    subtitle: Schema.optionalKey(Schema.NullOr(Schema.String)),
    tags: Schema.optionalKey(
      Schema.Array(Schema.Struct({ name: Schema.String, slug: Schema.String }))
    ),
    title: Schema.optionalKey(Schema.String),
  }),
});

const inputOf = Schema.decodeUnknownSync(InputSchema);

// A change made in the request, as the tests of DEV run theirs: nothing
// here waits, so the clock stays.
const inRequest = <A, E, R>(change: Effect.Effect<A, E, R>) =>
  Effect.gen(function* running() {
    const fiber = yield* Effect.forkChild(change);

    yield* TestClock.adjust("1 second");

    return yield* Fiber.join(fiber);
  });

describe("an article on Hashnode", () => {
  it.effect("goes once: its files, confirmed, then the post in Markdown", () =>
    onArticles(
      Effect.gen(function* sent() {
        const { hashnode, sent: article } = yield* sentToHashnode(
          {},
          { tags: ["Peas & beans", "spring"], title: "Spring <sowing>" }
        );

        assert.strictEqual(stateOf(article), "published");

        const operations = hashnode
          .requests()
          .map(({ operation }) => operation);

        assert.deepStrictEqual(operations, [
          "PealImageUpload",
          "PealConfirmImage",
          "PealImageUpload",
          "PealConfirmImage",
          "PealPublishPost",
        ]);

        const publish = hashnode
          .requests()
          .find(({ operation }) => operation === "PealPublishPost");

        const { input } = inputOf(publish?.variables);
        const [cover, body] = [...hashnode.uploads().keys()];

        assert.strictEqual(input.publicationId, gardenBlog.id);
        assert.strictEqual(input.title, "Spring <sowing>");
        assert.strictEqual(input.subtitle, "What to sow first.");
        assert.strictEqual(input.coverImage, cover);
        assert.deepStrictEqual(input.tags, [
          { name: "Peas & beans", slug: "peas-beans" },
          { name: "spring", slug: "spring" },
        ]);
        assert.strictEqual(
          input.contentMarkdown,
          [
            "## Sow early",
            "Peas &amp; beans &lt;first&gt;\\.",
            `![A row of peas](${body})`,
          ].join("\n\n")
        );

        const [post] = hashnode.posts();

        assert.isTrue(
          article.state._tag === "published" &&
            article.state.platformPostId === post?.id &&
            article.state.permalink !== undefined
        );
      })
    )
  );

  it.effect("stays a draft there when told, and is deleted as one", () =>
    onArticles(
      Effect.gen(function* draft() {
        const {
          actor,
          hashnode,
          sent: article,
        } = yield* sentToHashnode({}, { siteStatus: "draft" });

        const [made] = hashnode.posts();

        assert.isTrue(made?.draft);
        assert.isTrue(
          article.state._tag === "published" &&
            article.state.platformPostId === `draft:${made?.id}`
        );

        yield* inRequest((yield* Articles).unpublish(actor, article.id));

        assert.isTrue(hashnode.posts()[0]?.removed);
        assert.isTrue(
          hashnode
            .requests()
            .some(({ operation }) => operation === "PealDeleteDraft")
        );
      })
    )
  );

  it.effect("adopts its post when Hashnode's answer was lost", () =>
    onArticles(
      Effect.gen(function* lost() {
        const { hashnode, sent: article } = yield* sentToHashnode({
          drop: ({ operation }) => operation === "PealPublishPost",
        });

        assert.strictEqual(stateOf(article), "published");
        assert.lengthOf(hashnode.posts(), 1);
      })
    )
  );

  it.effect(
    "is to check, never sent again, when the answer was lost and none matches",
    () =>
      onArticles(
        Effect.gen(function* unknown() {
          const { hashnode, sent: article } = yield* sentToHashnode(
            {
              intercept: ({ operation }) =>
                operation === "PealPublishPost" ? { status: 502 } : undefined,
            },
            {},
            (fake) => {
              fake.addPost({
                markdown: "Other words.",
                title: "Spring sowing",
              });
            }
          );

          assert.strictEqual(stateOf(article), "unconfirmed");
          assert.lengthOf(
            hashnode
              .requests()
              .filter(({ operation }) => operation === "PealPublishPost"),
            1
          );
        })
      )
  );

  it.effect(
    "never sends again while Hashnode's cached reads may hide its post",
    () =>
      onArticles(
        Effect.gen(function* cached() {
          const {
            actor,
            hashnode,
            sent: article,
          } = yield* sentToHashnode({
            cacheSeconds: 25,
            drop: ({ operation }) => operation === "PealPublishPost",
          });

          // The search ran on a listing from before the post.
          assert.strictEqual(stateOf(article), "unconfirmed");

          yield* (yield* Articles).retry(actor, article.id);

          yield* eventuallyLater(
            "the article is sent again",
            ArticleStore.use((store) => store.get(article.id)).pipe(
              Effect.map((found) =>
                Option.exists(
                  found,
                  ({ state }) =>
                    state._tag !== "scheduled" && state._tag !== "publishing"
                )
              )
            )
          );

          assert.lengthOf(hashnode.posts(), 1);
          assert.strictEqual(
            stateOf(
              Option.getOrThrow(
                yield* ArticleStore.use((store) => store.get(article.id))
              )
            ),
            "published"
          );
        })
      )
  );

  it.effect(
    "is to check when Hashnode answers the commit with an unknown error",
    () =>
      onArticles(
        Effect.gen(function* unknownCode() {
          const { hashnode, sent: article } = yield* sentToHashnode({
            intercept: ({ operation }) =>
              operation === "PealPublishPost"
                ? {
                    body: {
                      data: null,
                      errors: [
                        {
                          extensions: { code: "GATEWAY_TIMEOUT" },
                          message: "upstream",
                        },
                      ],
                    },
                    status: 200,
                  }
                : undefined,
          });

          assert.strictEqual(stateOf(article), "unconfirmed");
          assert.lengthOf(
            hashnode
              .requests()
              .filter(({ operation }) => operation === "PealPublishPost"),
            1
          );
        })
      )
  );

  it.effect("fails, said so, on a publication without the Pro plan", () =>
    onArticles(
      Effect.gen(function* plan() {
        const { sent: article } = yield* sentToHashnode({
          publications: [{ ...gardenBlog, pro: false }],
        });

        assert.isTrue(
          article.state._tag === "failed" &&
            article.state.code === "sitePlanRequired"
        );
      })
    )
  );

  it.effect(
    "marks the channel to reconnect when Hashnode refuses the token",
    () =>
      onArticles(
        Effect.gen(function* refused() {
          const { channelId, sent: article } = yield* sentToHashnode({
            users: [],
          });

          assert.strictEqual(stateOf(article), "failed");

          const channel = yield* ChannelRepository.use((channels) =>
            channels.get(channelId)
          );

          assert.strictEqual(
            Option.getOrUndefined(channel)?.status._tag,
            "refreshNeeded"
          );
        })
      )
  );

  it.effect("is changed on Hashnode, then removed there", () =>
    onArticles(
      Effect.gen(function* live() {
        const { actor, hashnode, sent: article } = yield* sentToHashnode();
        const articles = yield* Articles;

        yield* inRequest(
          articles.updateOnSite(
            actor,
            article.id,
            content({ categories: [], title: "Spring sowing, revised" })
          )
        );

        assert.strictEqual(
          hashnode.posts()[0]?.title,
          "Spring sowing, revised"
        );

        yield* inRequest(articles.unpublish(actor, article.id));

        assert.isTrue(hashnode.posts()[0]?.removed);
      })
    )
  );

  it.effect(
    "is refused a time the site would publish it at, and categories",
    () =>
      onArticles(
        Effect.gen(function* rules() {
          yield* startHashnode();

          const workspaceId = yield* freshWorkspace;
          const channel = yield* hashnodeChannel(workspaceId);

          const refused = yield* (yield* Articles)
            .create(
              writer(workspaceId),
              {
                channelId: channel.id,
                content: content({ siteStatus: "future" }),
              },
              Option.some({ at: Option.none(), timeZone: zone })
            )
            .pipe(Effect.flip);

          assert.strictEqual(refused._tag, "ArticleRejected");
          assert.includeDeepMembers(
            refused._tag === "ArticleRejected" ? [...refused.violations] : [],
            [
              { _tag: "siteStatusNotTaken", status: "future" },
              { _tag: "tooManyTerms", field: "categories", maximum: 0 },
            ]
          );
        })
      )
  );
});
