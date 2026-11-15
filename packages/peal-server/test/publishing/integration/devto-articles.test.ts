// Articles on DEV: files to its image API, the article in Markdown, one
// write a second, a lost answer looked for among the member's articles,
// never sent twice; DEV's rules checked when it is scheduled.
import { Buffer } from "node:buffer";

import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Fiber, Option, Schema } from "effect";
import { TestClock } from "effect/testing";

import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { Articles } from "#publishing/application/articles.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { coverImage } from "#test/publishing/article-server.ts";
import {
  content,
  eventuallyLater,
  onArticles,
  stateOf,
  writer,
  zone,
} from "#test/publishing/article-support.ts";
import {
  devtoChannel,
  sentToDevTo,
  startDevTo,
} from "#test/publishing/devto-support.ts";

const SentSchema = Schema.fromJsonString(
  Schema.Struct({
    article: Schema.Struct({
      body_markdown: Schema.String,
      description: Schema.optionalKey(Schema.String),
      main_image: Schema.optionalKey(Schema.NullOr(Schema.String)),
      published: Schema.optionalKey(Schema.Boolean),
      published_at: Schema.optionalKey(Schema.String),
      tags: Schema.optionalKey(Schema.Array(Schema.String)),
      title: Schema.optionalKey(Schema.String),
    }),
  })
);

// Runs a change made in the request, moving the virtual clock a second
// at a time meanwhile: DEV's writes wait a second apart.
const clockMoving = <A, E, R>(change: Effect.Effect<A, E, R>) =>
  Effect.gen(function* moving() {
    const fiber = yield* Effect.forkChild(change);

    while (fiber.pollUnsafe() === undefined) {
      yield* TestClock.adjust(Duration.seconds(1));
      yield* TestClock.withLive(Effect.sleep(Duration.millis(5)));
    }

    return yield* Fiber.join(fiber);
  });

const sentFields = (body: Buffer) =>
  Schema.decodeUnknownSync(SentSchema)(body.toString()).article;

describe("an article on DEV", () => {
  it.effect("goes once: its files, then the article in Markdown", () =>
    onArticles(
      Effect.gen(function* sent() {
        const { devto, sent: article } = yield* sentToDevTo(
          {},
          { title: "Peas & <b>beans</b>" }
        );

        assert.strictEqual(stateOf(article), "published");

        const requests = devto.requests();

        const posts = requests.filter(
          ({ method, path }) => method === "POST" && path === "/api/articles"
        );

        assert.lengthOf(posts, 1);
        assert.lengthOf(
          requests.filter(({ path }) => path === "/api/images"),
          2
        );

        // The cover's bytes went as the form's `image` file.
        const [first] = [...devto.images().values()];

        assert.isTrue(
          first !== undefined &&
            first.includes(Buffer.from(coverImage.bytes)) &&
            first.includes(Buffer.from('name="image"'))
        );

        const [made] = devto.articles();
        const images = [...devto.images().keys()];

        // Plain text, as DEV escapes it itself.
        assert.strictEqual(made?.title, "Peas & <b>beans</b>");
        assert.strictEqual(made?.description, "What to sow first.");
        assert.deepStrictEqual(made?.tags, ["peas", "spring"]);
        assert.isTrue(made?.published);
        assert.strictEqual(made?.main_image, images[0]);
        assert.strictEqual(
          made?.body_markdown,
          [
            "## Sow early",
            "Peas &amp; beans &lt;first&gt;\\.",
            `![A row of peas](${images[1]})`,
          ].join("\n\n")
        );

        assert.isTrue(
          article.state._tag === "published" &&
            article.state.platformPostId === String(made?.id) &&
            article.state.permalink !== undefined
        );
      })
    )
  );

  it.effect("spaces its writes a second apart, as DEV asks", () =>
    onArticles(
      Effect.gen(function* spaced() {
        const { devto } = yield* sentToDevTo();

        const writes = devto
          .requests()
          .filter(({ method }) => method !== "GET")
          .map(({ receivedAt }) => receivedAt);

        assert.lengthOf(writes, 3);

        for (const [index, at] of writes.entries()) {
          const before = writes[index - 1];

          assert.isTrue(before === undefined || at - before >= 1000);
        }
      })
    )
  );

  it.effect("stays a draft on DEV when told, and waits there when told", () =>
    onArticles(
      Effect.gen(function* drafts() {
        const { devto } = yield* sentToDevTo({}, { siteStatus: "draft" });

        assert.isFalse(devto.articles()[0]?.published);

        const later = yield* startDevTo();
        const workspaceId = yield* freshWorkspace;
        const channel = yield* devtoChannel(workspaceId);
        const at = DateTime.addDuration(yield* DateTime.now, Duration.days(2));

        yield* (yield* Articles).create(
          writer(workspaceId),
          {
            channelId: channel.id,
            content: content({ categories: [], siteStatus: "future" }),
          },
          Option.some({ at: Option.some(at), timeZone: zone })
        );

        yield* eventuallyLater(
          "DEV has it",
          Effect.sync(() => later.articles().length === 1)
        );

        const post = later
          .requests()
          .find(({ path }) => path === "/api/articles");

        const fields = post === undefined ? undefined : sentFields(post.body);

        assert.isTrue(fields?.published);
        assert.strictEqual(fields?.published_at, DateTime.formatIso(at));
      })
    )
  );

  it.effect("adopts its article when DEV's answer was lost", () =>
    onArticles(
      Effect.gen(function* lost() {
        const { devto, sent: article } = yield* sentToDevTo({
          drop: ({ method, path }) =>
            method === "POST" && path === "/api/articles",
        });

        assert.strictEqual(stateOf(article), "published");
        assert.lengthOf(devto.articles(), 1);
        assert.isTrue(
          article.state._tag === "published" &&
            article.state.platformPostId === String(devto.articles()[0]?.id)
        );
      })
    )
  );

  it.effect(
    "is to check, never sent again, when the answer was lost and none matches",
    () =>
      onArticles(
        Effect.gen(function* unknown() {
          const { devto, sent: article } = yield* sentToDevTo(
            {
              intercept: ({ method, path }) =>
                method === "POST" && path === "/api/articles"
                  ? { body: { error: "boom", status: 502 }, status: 502 }
                  : undefined,
            },
            {},
            (fake) => {
              // Written by hand, of that title, long before: not it.
              fake.addArticle({
                body_markdown: "Something else.",
                title: "Spring sowing",
              });
            }
          );

          assert.strictEqual(stateOf(article), "unconfirmed");
          assert.lengthOf(
            devto
              .requests()
              .filter(
                ({ method, path }) =>
                  method === "POST" && path === "/api/articles"
              ),
            1
          );
        })
      )
  );

  it.effect("marks the channel to reconnect when DEV refuses the key", () =>
    onArticles(
      Effect.gen(function* refusedKey() {
        const { channelId, sent: article } = yield* sentToDevTo({ users: [] });

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

  it.effect("fails, with DEV's refusal, an article DEV will not take", () =>
    onArticles(
      Effect.gen(function* refused() {
        const { sent: article } = yield* sentToDevTo({
          intercept: ({ method, path }) =>
            method === "POST" && path === "/api/articles"
              ? {
                  body: { error: "Body markdown is too long", status: 422 },
                  status: 422,
                }
              : undefined,
        });

        assert.isTrue(
          article.state._tag === "failed" &&
            article.state.code === "unprocessable_entity"
        );
      })
    )
  );

  it.effect("waits for DEV's limit, then goes", () =>
    onArticles(
      Effect.gen(function* limited() {
        let limitedOnce = false;

        const { devto, sent: article } = yield* sentToDevTo({
          intercept: ({ method, path }) => {
            const first =
              method === "POST" && path === "/api/articles" && !limitedOnce;

            limitedOnce ||= first;

            return first
              ? {
                  body: { error: "Rate limit reached", status: 429 },
                  headers: { "retry-after": "30" },
                  status: 429,
                }
              : undefined;
          },
        });

        assert.strictEqual(stateOf(article), "published");
        assert.lengthOf(devto.articles(), 1);
        // Its files were sent once, before the limit.
        assert.lengthOf(
          devto.requests().filter(({ path }) => path === "/api/images"),
          2
        );
      })
    )
  );

  it.effect("is changed on DEV, then a draft again there", () =>
    onArticles(
      Effect.gen(function* live() {
        const { actor, devto, sent: article } = yield* sentToDevTo();
        const articles = yield* Articles;

        yield* clockMoving(
          articles.updateOnSite(
            actor,
            article.id,
            content({ categories: [], title: "Spring sowing, revised" })
          )
        );

        assert.strictEqual(
          devto.articles()[0]?.title,
          "Spring sowing, revised"
        );
        assert.isTrue(devto.articles()[0]?.published);

        const removed = yield* clockMoving(
          articles.unpublish(actor, article.id)
        );

        assert.isFalse(devto.articles()[0]?.published);
        assert.lengthOf(devto.articles(), 1);
        assert.isTrue(
          removed.state._tag === "published" &&
            removed.state.removedAt !== undefined
        );
      })
    )
  );

  it.effect("is refused at scheduling where DEV would refuse it", () =>
    onArticles(
      Effect.gen(function* rules() {
        yield* startDevTo();

        const workspaceId = yield* freshWorkspace;
        const channel = yield* devtoChannel(workspaceId);

        const refused = yield* (yield* Articles)
          .create(
            writer(workspaceId),
            {
              channelId: channel.id,
              content: content({
                categories: ["Vegetables"],
                tags: ["one", "two", "three", "four", "fi-ve"],
                title: "t".repeat(129),
              }),
            },
            Option.some({ at: Option.none(), timeZone: zone })
          )
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "ArticleRejected");
        assert.includeDeepMembers(
          refused._tag === "ArticleRejected" ? [...refused.violations] : [],
          [
            { _tag: "titleTooLong", maximum: 128 },
            { _tag: "tooManyTerms", field: "tags", maximum: 4 },
            { _tag: "termInvalid", field: "tags" },
            { _tag: "tooManyTerms", field: "categories", maximum: 0 },
          ]
        );
      })
    )
  );
});
