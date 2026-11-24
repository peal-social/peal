// Articles on DEV: files to its image API, the article in Markdown, one
// write a second, a lost answer looked for among the member's articles,
// never sent twice; DEV's rules checked when it is scheduled.
import { Buffer } from "node:buffer";

import { assert, describe, it } from "@effect/vitest";
import {
  Clock,
  DateTime,
  Duration,
  Effect,
  Fiber,
  Option,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

import { ArticleStore } from "#articles/application/article-store.ts";
import { Articles } from "#articles/application/articles.ts";
import type { ArticleContent } from "#articles/domain/article-content.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { coverImage } from "#test/articles/article-server.ts";
import {
  content,
  eventuallyLater,
  onArticles,
  stateOf,
  untilWokenLater,
  writer,
  zone,
} from "#test/articles/article-support.ts";
import {
  devtoChannel,
  sentToDevTo,
  startDevTo,
} from "#test/articles/devto-support.ts";
import {
  gardener,
  neighbour,
  readAsForem,
} from "#test/channels/fakes/fake-devto.ts";
import { freshWorkspace } from "#test/channels/support.ts";

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

// An article of text alone, with no file to upload.
const plainContent = content({
  body: {
    content: [
      { content: [{ text: "Plain", type: "text" }], type: "paragraph" },
    ],
    type: "doc",
  },
  categories: [],
  coverMediaId: Option.none(),
});

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
  it.effect(
    "reads on DEV as typed: no Liquid made of braces, no stray backslash",
    () =>
      onArticles(
        Effect.gen(function* asTyped() {
          const { devto, sent: article } = yield* sentToDevTo(
            {},
            {
              body: {
                content: [
                  {
                    content: [
                      {
                        text: "Use {{ secrets.TOKEN }} and {% embed https://e.example %} for $5",
                        type: "text",
                      },
                      { type: "hardBreak" },
                      {
                        text: "then {% endraw %} { at https://example.com/a_b, mail a@b.example",
                        type: "text",
                      },
                    ],
                    type: "paragraph",
                  },
                ],
                type: "doc",
              },
              coverMediaId: Option.none(),
            }
          );

          assert.strictEqual(stateOf(article), "published");

          const reading = readAsForem(devto.articles()[0]?.body_markdown ?? "");

          assert.isFalse(reading.liveLiquid);
          assert.deepStrictEqual(reading.autolinks, []);
          assert.strictEqual(
            reading.text,
            "Use {{ secrets.TOKEN }} and {% embed https://e.example %} for $5  \nthen {% endraw %} { at https://example.com/a_b, mail a@b.example"
          );
        })
      )
  );

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

  // Text alone: an upload holds the turn to its start only, and DEV counts
  // it once its body is in, so two accounts' uploads may still meet a
  // short refusal there, which is waited out. Every other write holds the
  // turn to its end, and is spaced whatever account it is for.
  it.effect("spaces every write to DEV, whichever account it is for", () =>
    onArticles(
      Effect.gen(function* shared() {
        const devto = yield* startDevTo({ writesPerSecond: true });
        const articles = yield* Articles;
        const sent = [];

        for (const key of [gardener.key, neighbour.key]) {
          const workspaceId = yield* freshWorkspace;
          const channel = yield* devtoChannel(workspaceId, key);

          sent.push(
            yield* articles.create(
              writer(workspaceId),
              { channelId: channel.id, content: plainContent },
              Option.some({ at: Option.none(), timeZone: zone })
            )
          );
        }

        yield* eventuallyLater(
          "both are on DEV",
          Effect.sync(() => devto.articles().length === 2)
        );

        assert.strictEqual(devto.throttled(), 0);
      })
    )
  );

  it.effect(
    "changes an article on DEV at once, while another's upload is long",
    () =>
      onArticles(
        Effect.gen(function* alongside() {
          const devto = yield* startDevTo({
            intercept: ({ headers, path }) =>
              path === "/api/images" && headers["api-key"] === gardener.key
                ? "hang"
                : undefined,
          });

          const articles = yield* Articles;
          const neighbourSpace = yield* freshWorkspace;

          const neighbourChannel = yield* devtoChannel(
            neighbourSpace,
            neighbour.key
          );

          const neighbourWriter = writer(neighbourSpace);

          const plainFields: Partial<ArticleContent> = {
            body: {
              content: [
                {
                  content: [{ text: "Plain", type: "text" }],
                  type: "paragraph",
                },
              ],
              type: "doc",
            },
            categories: [],
            coverMediaId: Option.none(),
          };

          const plain = content(plainFields);

          const live = yield* articles.create(
            neighbourWriter,
            { channelId: neighbourChannel.id, content: plain },
            Option.some({ at: Option.none(), timeZone: zone })
          );

          yield* eventuallyLater(
            "the neighbour's article is on DEV",
            Effect.sync(() => devto.articles().length === 1)
          );

          // The gardener's article starts its upload, which never ends.
          const gardenerSpace = yield* freshWorkspace;
          const gardenerChannel = yield* devtoChannel(gardenerSpace);

          yield* articles.create(
            writer(gardenerSpace),
            {
              channelId: gardenerChannel.id,
              content: content({ categories: [] }),
            },
            Option.some({ at: Option.none(), timeZone: zone })
          );

          yield* eventuallyLater(
            "the upload has started",
            Effect.sync(() =>
              devto
                .requests()
                .some(
                  ({ headers, path }) =>
                    path === "/api/images" &&
                    headers["api-key"] === gardener.key
                )
            )
          );

          const before = yield* Clock.currentTimeMillis;

          yield* clockMoving(
            articles.updateOnSite(
              neighbourWriter,
              live.id,
              content({ ...plainFields, title: "Spring sowing, revised" })
            )
          );

          const after = yield* Clock.currentTimeMillis;

          assert.isBelow(after - before, 30_000);
          assert.strictEqual(
            devto.articles().find(({ userId }) => userId === neighbour.id)
              ?.title,
            "Spring sowing, revised"
          );
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

  it.effect(
    "adopts its article when the answer was lost, whatever DEV made of its title",
    () =>
      onArticles(
        Effect.gen(function* rewritten() {
          const { devto, sent: article } = yield* sentToDevTo(
            {
              drop: ({ method, path }) =>
                method === "POST" && path === "/api/articles",
            },
            { title: "10×  faster sowing" }
          );

          assert.strictEqual(devto.articles()[0]?.title, "10 faster sowing");
          assert.strictEqual(stateOf(article), "published");
          assert.lengthOf(devto.articles(), 1);
        })
      )
  );

  it.effect(
    "never sends again while an article of its title holds another body",
    () =>
      onArticles(
        Effect.gen(function* uncertain() {
          const {
            actor,
            devto,
            sent: article,
          } = yield* sentToDevTo(
            {
              intercept: ({ method, path }) =>
                method === "POST" && path === "/api/articles"
                  ? { body: { error: "boom", status: 502 }, status: 502 }
                  : undefined,
            },
            {},
            (fake) => {
              fake.addArticle({
                body_markdown: "Something else.",
                published: true,
                // Written by hand within the call's window.
                published_at: "2026-06-15T07:00:30.000Z",
                title: "Spring sowing",
              });
            }
          );

          assert.strictEqual(stateOf(article), "unconfirmed");
          // The member is told why: another article of that title is there.
          assert.isTrue(
            article.state._tag === "unconfirmed" &&
              article.state.reason === "severalOnSite"
          );

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

          const again = yield* ArticleStore.use((store) =>
            store.get(article.id)
          ).pipe(Effect.map(Option.getOrThrow));

          assert.isTrue(
            again.state._tag === "unconfirmed" &&
              again.state.reason === "severalOnSite"
          );

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

  it.effect("tells a title of signs alone from another, by the signs", () =>
    onArticles(
      Effect.gen(function* signs() {
        const { sent: article } = yield* sentToDevTo(
          {
            intercept: ({ method, path }) =>
              method === "POST" && path === "/api/articles"
                ? { body: { error: "boom", status: 502 }, status: 502 }
                : undefined,
          },
          { title: "!!!" },
          (fake) => {
            fake.addArticle({
              body_markdown: "Something else.",
              published: true,
              published_at: "2026-06-15T07:00:30.000Z",
              title: "???",
            });
          }
        );

        assert.isTrue(
          article.state._tag === "unconfirmed" &&
            article.state.reason === "noResponse"
        );
      })
    )
  );

  it.effect("finds a published article past the account's drafts", () =>
    onArticles(
      Effect.gen(function* manyDrafts() {
        const { sent: article } = yield* sentToDevTo(
          {
            drop: ({ method, path }) =>
              method === "POST" && path === "/api/articles",
          },
          {},
          (fake) => {
            for (let draft = 0; draft < 160; draft += 1) {
              fake.addArticle({ title: `Draft ${draft}` });
            }
          }
        );

        assert.strictEqual(stateOf(article), "published");
      })
    )
  );

  it.effect("drops a time DEV would take as past, once it has gone by", () =>
    onArticles(
      Effect.gen(function* late() {
        let limited = false;

        const devto = yield* startDevTo({
          intercept: ({ method, path }) => {
            const first =
              method === "POST" && path === "/api/articles" && !limited;

            limited ||= first;

            return first
              ? {
                  body: { error: "Rate limit reached", status: 429 },
                  headers: { "retry-after": "1500" },
                  status: 429,
                }
              : undefined;
          },
        });

        const workspaceId = yield* freshWorkspace;
        const channel = yield* devtoChannel(workspaceId);

        const at = DateTime.addDuration(
          yield* DateTime.now,
          Duration.minutes(5)
        );

        const made = yield* (yield* Articles).create(
          writer(workspaceId),
          {
            channelId: channel.id,
            content: content({ categories: [], siteStatus: "future" }),
          },
          Option.some({ at: Option.some(at), timeZone: zone })
        );

        // DEV takes its own time, so the article goes at once, and DEV
        // holds it back 25 minutes, past that time: the clock goes to the
        // retry's wake-up the job stored.
        yield* eventuallyLater(
          "DEV holds the article back",
          Effect.sync(() => limited)
        );

        const retried = yield* untilWokenLater("DEV's limit is over");

        assert.isTrue(DateTime.isGreaterThan(retried, at));

        yield* eventuallyLater(
          "the article is sent",
          ArticleStore.use((store) => store.get(made.id)).pipe(
            Effect.map((found) =>
              Option.exists(
                found,
                ({ state }) =>
                  state._tag !== "scheduled" && state._tag !== "publishing"
              )
            )
          )
        );

        const sent = yield* ArticleStore.use((store) => store.get(made.id));

        assert.strictEqual(
          Option.getOrUndefined(sent)?.state._tag,
          "published"
        );
        assert.lengthOf(devto.articles(), 1);
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
