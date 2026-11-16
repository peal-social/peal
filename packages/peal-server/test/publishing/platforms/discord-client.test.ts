import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Option, Schema } from "effect";

import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { DiscordOptions } from "#publishing/domain/discord-options.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  discordAccount,
  discordChannel,
  discordGuild,
  discordSecret,
  discordWebhookId,
  fakeDiscordApi,
} from "#test/publishing/fakes/fake-discord-api.ts";
import type {
  FakeDiscord,
  FakeDiscordOptions,
} from "#test/publishing/fakes/fake-discord-api.ts";
import {
  headerOf,
  json,
  jsonBodyOf,
} from "#test/publishing/fakes/platform-server.ts";

import {
  attached,
  credentialsOf,
  discordClientWith,
  httpClientTimingOutAfter,
  outgoing,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

const onDiscord = Effect.fn("test.onDiscord")(function* onDiscord(
  options: {
    readonly api?: FakeDiscordOptions;
    readonly files?: readonly TestFile[];
    readonly secret?: string;
    readonly timeout?: Duration.Input;
  } = {}
) {
  const discord = yield* fakeDiscordApi(options.api);

  const credentials = credentialsOf(
    { accountId: discordAccount, platform: "discord" },
    [options.secret ?? discordSecret]
  );

  const client = yield* discordClientWith({
    api: discord.url,
    credentials,
    files: options.files ?? [],
    http:
      options.timeout === undefined
        ? undefined
        : yield* httpClientTimingOutAfter(options.timeout),
  });

  return { client, discord };
});

const post = (fields: Partial<OutgoingPost> = {}) =>
  outgoing({ ...fields, accountId: discordAccount });

const withOptions = (fields: ConstructorParameters<typeof DiscordOptions>[0]) =>
  Option.some(new DiscordOptions(fields));

const commits = (discord: FakeDiscord) =>
  discord
    .requests()
    .filter(
      ({ method, path }) => method === "POST" && path === discord.webhookPath
    );

const PayloadSchema = Schema.Record(Schema.String, Schema.Unknown);

describe("publishing in a Discord channel through its webhook", () => {
  it.live(
    "posts a text, notifying nobody it mentions, and waits for the message",
    () =>
      Effect.gen(function* text() {
        const { client, discord } = yield* onDiscord();

        const result = yield* client.publish(
          yield* post({ text: "Synthetic news for @everyone" })
        );

        const [message] = discord.messages();
        const [call] = commits(discord);

        assert(message !== undefined && call !== undefined);
        assert.deepStrictEqual(result, {
          _tag: "published",
          permalink: `https://discord.com/channels/${discordGuild}/${discordChannel}/${message.id}`,
          platformPostId: PlatformPostIdSchema.make(
            `${discordWebhookId}/${discordChannel}/${message.id}`
          ),
        });
        assert.deepStrictEqual(jsonBodyOf(PayloadSchema)(call), {
          allowed_mentions: { parse: [] },
          content: "Synthetic news for @everyone",
        });
        assert.strictEqual(call.query.get("wait"), "true");
        assert.isFalse(call.query.has("thread_id"));
        assert.strictEqual(
          headerOf(call, "user-agent"),
          "DiscordBot (https://github.com/peal-social/peal, 1.0)"
        );
      }).pipe(Effect.scoped)
  );

  it.live(
    "notifies mentions, sends silently and without embeds, as the options say",
    () =>
      Effect.gen(function* options() {
        const { client, discord } = yield* onDiscord();

        yield* client.publish(
          yield* post({
            options: withOptions({
              mentions: true,
              silent: true,
              suppressEmbeds: true,
            }),
          })
        );

        assert.deepStrictEqual(discord.messages()[0]?.payload, {
          allowed_mentions: { parse: ["users", "roles", "everyone"] },
          content: "Hello from a synthetic account",
          flags: 4100,
        });
      }).pipe(Effect.scoped)
  );

  it.live("sends files in one form, each with its alt text", () =>
    Effect.gen(function* files() {
      const image = testFile("image", 2048);
      const gif = testFile("image", 1024, "image/gif");
      const video = testFile("video", 4096);

      const { client, discord } = yield* onDiscord({
        files: [image, gif, video],
      });

      yield* client.publish(
        yield* post({
          media: [
            attached(image),
            attached(gif, " "),
            attached(video, "A synthetic clip"),
          ],
          text: "",
        })
      );

      const [message] = discord.messages();

      assert(message !== undefined);
      assert.deepStrictEqual(message.payload, {
        allowed_mentions: { parse: [] },
        attachments: [
          { description: "A synthetic picture", id: 0 },
          { id: 1 },
          { description: "A synthetic clip", id: 2 },
        ],
      });
      assert.deepStrictEqual(
        message.files.map(({ contentType, fileName, name }) => [
          name,
          fileName,
          contentType,
        ]),
        [
          ["files[0]", image.media.fileName, "image/png"],
          ["files[1]", gif.media.fileName, "image/gif"],
          ["files[2]", video.media.fileName, "video/mp4"],
        ]
      );
      assert.deepStrictEqual(
        message.files.map(({ data }) => data),
        [image.bytes, gif.bytes, video.bytes]
      );
    }).pipe(Effect.scoped)
  );

  it.live("posts the parts of a thread one after the other in a channel", () =>
    Effect.gen(function* parts() {
      const { client, discord } = yield* onDiscord();

      const first = yield* client.publish(yield* post({ text: "One" }));

      assert(first._tag === "published");

      yield* client.publish(
        yield* post({
          part: 1,
          replyTo: Option.some({
            parent: first.platformPostId,
            root: first.platformPostId,
          }),
          text: "Two",
        })
      );

      const [, second] = commits(discord);

      assert(second !== undefined);
      assert.isFalse(second.query.has("thread_id"));
      assert.deepStrictEqual(
        discord.messages().map(({ channelId }) => channelId),
        [discordChannel, discordChannel]
      );
    }).pipe(Effect.scoped)
  );

  it.live(
    "keeps a thread in the webhook's channel after a server moved the webhook",
    () =>
      Effect.gen(function* moved() {
        // The webhook now posts in another channel than the one connected.
        const { client, discord } = yield* onDiscord({
          api: { channel: "300000000000000009" },
        });

        const first = yield* client.publish(yield* post({ text: "One" }));

        assert(first._tag === "published");

        const second = yield* client.publish(
          yield* post({
            part: 1,
            replyTo: Option.some({
              parent: first.platformPostId,
              root: first.platformPostId,
            }),
            text: "Two",
          })
        );

        assert.strictEqual(second._tag, "published");

        const [, call] = commits(discord);

        assert(call !== undefined);
        assert.isFalse(call.query.has("thread_id"));
        assert.deepStrictEqual(
          discord.messages().map(({ channelId }) => channelId),
          ["300000000000000009", "300000000000000009"]
        );
      }).pipe(Effect.scoped)
  );

  it.live(
    "opens a forum post with its title, and puts the later parts in it",
    () =>
      Effect.gen(function* forum() {
        const { client, discord } = yield* onDiscord({ api: { forum: true } });
        const options = withOptions({ threadName: "A synthetic forum post" });

        const first = yield* client.publish(
          yield* post({ options, text: "One" })
        );

        assert(first._tag === "published");

        const [opened] = discord.messages();

        assert(opened !== undefined);
        assert.notStrictEqual(opened.channelId, discordChannel);
        assert.strictEqual(
          opened.payload["thread_name"],
          "A synthetic forum post"
        );
        // Named with the webhook that sent it, as the start of a thread.
        assert.strictEqual(
          first.platformPostId,
          PlatformPostIdSchema.make(
            `${discordWebhookId}/${opened.channelId}/${opened.id}/thread`
          )
        );

        yield* client.publish(
          yield* post({
            options,
            part: 1,
            replyTo: Option.some({
              parent: first.platformPostId,
              root: first.platformPostId,
            }),
            text: "Two",
          })
        );

        const [, reply] = discord.messages();
        const [, call] = commits(discord);

        assert(reply !== undefined && call !== undefined);
        assert.strictEqual(call.query.get("thread_id"), opened.channelId);
        assert.strictEqual(reply.channelId, opened.channelId);
        assert.isUndefined(reply.payload["thread_name"]);
      }).pipe(Effect.scoped)
  );

  it.live(
    "refuses a forum post without a title, and a title outside a forum",
    () =>
      Effect.gen(function* titles() {
        const forum = yield* onDiscord({ api: { forum: true } });

        assert.deepStrictEqual(
          yield* forum.client.publish(yield* post()).pipe(Effect.flip),
          new BadRequest({ code: "forumThreadNameRequired" })
        );

        const channel = yield* onDiscord();

        assert.deepStrictEqual(
          yield* channel.client
            .publish(
              yield* post({ options: withOptions({ threadName: "A title" }) })
            )
            .pipe(Effect.flip),
          new BadRequest({ code: "threadNameNotTaken" })
        );
        // Never sent again without it: one request each.
        assert.strictEqual(commits(channel.discord).length, 1);
      }).pipe(Effect.scoped)
  );

  it.live("never sends a message again when its answer is lost", () =>
    Effect.gen(function* lost() {
      for (const script of [
        { _tag: "postThenDrop" } as const,
        { _tag: "postThenFail", status: 502 } as const,
      ]) {
        const { client, discord } = yield* onDiscord();

        discord.script(`POST ${discord.webhookPath}`, [script]);

        const result = yield* client.publish(yield* post());

        assert.deepStrictEqual(result, {
          _tag: "unconfirmed",
          reason: "noResponse",
        });
        assert.strictEqual(commits(discord).length, 1);
        assert.strictEqual(discord.messages().length, 1);
      }
    }).pipe(Effect.scoped)
  );

  it.live(
    "leaves a message unconfirmed when Discord takes it and never answers",
    () =>
      Effect.gen(function* silence() {
        const { client, discord } = yield* onDiscord({ timeout: "300 millis" });

        discord.script(`POST ${discord.webhookPath}`, [{ _tag: "hang" }]);

        const result = yield* client.publish(yield* post());

        assert.strictEqual(result._tag, "unconfirmed");
        assert.strictEqual(commits(discord).length, 1);
      }).pipe(Effect.scoped)
  );

  it.live("answers a resumed attempt unconfirmed, sending nothing", () =>
    Effect.gen(function* resumed() {
      const { client, discord } = yield* onDiscord();

      const result = yield* client.resume(yield* post());

      assert.deepStrictEqual(result, {
        _tag: "unconfirmed",
        reason: "interrupted",
      });
      assert.deepStrictEqual(discord.requests(), []);
    }).pipe(Effect.scoped)
  );

  it.live("waits as long as a 429 asks, sending once", () =>
    Effect.gen(function* limited() {
      const { client, discord } = yield* onDiscord();

      discord.script(`POST ${discord.webhookPath}`, [
        json(
          {
            global: false,
            message: "You are being rate limited.",
            retry_after: 1.5,
          },
          429
        ),
      ]);

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new RateLimited({ retryAfter: Duration.millis(1500) })
      );
      assert.strictEqual(commits(discord).length, 1);
    }).pipe(Effect.scoped)
  );

  it.live(
    "takes a deleted webhook as a refused token, and calls it no more",
    () =>
      Effect.gen(function* deleted() {
        const { client, discord } = yield* onDiscord({ api: { gone: true } });

        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new TokenExpired()
        );
        assert.strictEqual(discord.requests().length, 1);
      }).pipe(Effect.scoped)
  );

  it.live(
    "refuses a file too large, and a message moderation blocked, by their codes",
    () =>
      Effect.gen(function* refusals() {
        const { client, discord } = yield* onDiscord();

        discord.script(`POST ${discord.webhookPath}`, [
          json({ code: 50_045, message: "Synthetic" }, 413),
          json({ code: 200_000, message: "Synthetic" }, 400),
          json({ message: "Synthetic proxy" }, 403),
        ]);

        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new MediaRejected({ code: "tooLarge" })
        );
        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new BadRequest({ code: "discord200000" })
        );
        // A refusal without Discord's code came from a server on the way:
        // the message may be there.
        assert.deepStrictEqual(yield* client.publish(yield* post()), {
          _tag: "unconfirmed",
          reason: "noResponse",
        });
      }).pipe(Effect.scoped)
  );

  it.live("sends nothing for a secret that is not a webhook's", () =>
    Effect.gen(function* invalid() {
      const { client, discord } = yield* onDiscord({
        secret: "synthetic-not-a-webhook",
      });

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new BadRequest({ code: "invalidCredential" })
      );
      assert.deepStrictEqual(discord.requests(), []);
    }).pipe(Effect.scoped)
  );
});
