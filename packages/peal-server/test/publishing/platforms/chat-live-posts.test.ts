import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { HttpClientError, HttpClientRequest } from "effect/http";

import type { PendingEdit } from "#publishing/application/live-post-edits.ts";
import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { DiscordOptions } from "#publishing/domain/discord-options.ts";
import { LivePostChangeIdSchema } from "#publishing/domain/live-post-change-id.ts";
import { unansweredAfterSending } from "#publishing/domain/removal-decision.ts";
import { sentUnanswered } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  discordAccount,
  discordSecret,
  fakeDiscordApi,
} from "#test/publishing/fakes/fake-discord-api.ts";
import type { FakeDiscordOptions } from "#test/publishing/fakes/fake-discord-api.ts";
import {
  fakeTelegramApi,
  telegramAccount,
  telegramBotToken,
} from "#test/publishing/fakes/fake-telegram-api.ts";
import { jsonBodyOf } from "#test/publishing/fakes/platform-server.ts";

import {
  attached,
  credentialsOf,
  discordClientWith,
  liveClientsOn,
  outgoing,
  telegramClientWith,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

// Deleting and editing posts on Discord and Telegram, against the loopback
// fakes, as the gates' RemoveLivePost and EditLivePost calls do.

const channelId = ChannelIdSchema.make("00000000-0000-7000-8000-0000000000c1");

const changeId = LivePostChangeIdSchema.make(
  "00000000-0000-7000-8000-0000000000e1"
);

const idOf = (result: PublishResult) =>
  result._tag === "published"
    ? Effect.succeed(result.platformPostId)
    : Effect.die(`The post was not published: ${result._tag}`);

const onDiscord = Effect.fn("test.onDiscord")(function* onDiscord(
  options: {
    readonly api?: FakeDiscordOptions;
    readonly edit?: PendingEdit;
  } = {}
) {
  const discord = yield* fakeDiscordApi(options.api);

  const credentials = Layer.succeedContext(
    yield* Layer.build(
      credentialsOf({ accountId: discordAccount, platform: "discord" }, [
        discordSecret,
      ])
    )
  );

  const client = yield* discordClientWith({ api: discord.url, credentials });

  const live = yield* liveClientsOn({
    credentials,
    edits:
      options.edit === undefined
        ? new Map()
        : new Map([[changeId, options.edit]]),
    platforms: { discordHosts: { api: discord.url } },
  });

  return { client, discord, live };
});

const discordPost = (fields: Partial<OutgoingPost> = {}) =>
  outgoing({ ...fields, accountId: discordAccount });

const PayloadSchema = Schema.Record(Schema.String, Schema.Json);

describe("deleting and editing on Discord", () => {
  it.live("deletes a message, and takes one gone as gone", () =>
    Effect.gen(function* deletes() {
      const { client, discord, live } = yield* onDiscord();

      const platformPostId = yield* idOf(
        yield* client.publish(yield* discordPost())
      );

      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "removed"
      );
      assert.deepStrictEqual(discord.messages(), []);
      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "alreadyGone"
      );
    }).pipe(Effect.scoped)
  );

  it.live("deletes a message in the forum post it opened, by its thread", () =>
    Effect.gen(function* forum() {
      const { client, discord, live } = yield* onDiscord({
        api: { forum: true },
      });

      const platformPostId = yield* idOf(
        yield* client.publish(
          yield* discordPost({
            options: Option.some(new DiscordOptions({ threadName: "A title" })),
          })
        )
      );

      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "removed"
      );

      const deletion = discord
        .requests()
        .find(({ method }) => method === "DELETE");

      assert.strictEqual(
        deletion?.query.get("thread_id"),
        platformPostId.split("/")[1]
      );
    }).pipe(Effect.scoped)
  );

  it.live(
    "replaces a message's text alone, with the mentions its options allow",
    () =>
      Effect.gen(function* edits() {
        const { client, discord, live } = yield* onDiscord({
          edit: {
            options: Option.some(new DiscordOptions({ mentions: false })),
            text: "Corrected @everyone",
          },
        });

        const platformPostId = yield* idOf(
          yield* client.publish(yield* discordPost())
        );

        assert.strictEqual(
          yield* live.edit({ changeId, channelId, platformPostId }),
          "edited"
        );

        const patch = discord
          .requests()
          .find(({ method }) => method === "PATCH");

        assert(patch !== undefined);
        assert.deepStrictEqual(jsonBodyOf(PayloadSchema)(patch), {
          allowed_mentions: { parse: [] },
          content: "Corrected @everyone",
        });
      }).pipe(Effect.scoped)
  );

  it.live(
    "says an edited message gone is gone, and a deleted webhook refused",
    () =>
      Effect.gen(function* refusals() {
        const { client, discord, live } = yield* onDiscord({
          edit: { options: Option.none(), text: "Corrected" },
        });

        const platformPostId = yield* idOf(
          yield* client.publish(yield* discordPost())
        );

        yield* live.remove({ channelId, platformPostId });

        assert.deepStrictEqual(
          yield* live
            .edit({ changeId, channelId, platformPostId })
            .pipe(Effect.flip),
          new BadRequest({ code: "postGone" })
        );

        discord.deleteWebhook();

        assert.deepStrictEqual(
          yield* live.remove({ channelId, platformPostId }).pipe(Effect.flip),
          new TokenExpired()
        );
      }).pipe(Effect.scoped)
  );

  it.live("refuses, before any call, a post another webhook sent", () =>
    Effect.gen(function* otherWebhook() {
      const { client, discord } = yield* onDiscord();

      const platformPostId = yield* idOf(
        yield* client.publish(yield* discordPost())
      );

      const sent = discord.requests().length;

      // The channel was reconnected with another webhook of its channel.
      const credentials = Layer.succeedContext(
        yield* Layer.build(
          credentialsOf({ accountId: discordAccount, platform: "discord" }, [
            "400000000000000002/synthetic-other-token",
          ])
        )
      );

      const live = yield* liveClientsOn({
        credentials,
        edits: new Map([[changeId, { options: Option.none(), text: "New" }]]),
        platforms: { discordHosts: { api: discord.url } },
      });

      for (const change of [
        live.remove({ channelId, platformPostId }),
        live.edit({ changeId, channelId, platformPostId }),
      ]) {
        assert.deepStrictEqual(
          yield* change.pipe(Effect.flip),
          new BadRequest({ code: "webhookChanged" })
        );
      }

      assert.lengthOf(discord.requests(), sent);
      assert.lengthOf(discord.messages(), 1);
    }).pipe(Effect.scoped)
  );

  it.live("asks nothing of an id that is not a message of Peal's", () =>
    Effect.gen(function* invalid() {
      const { discord, live } = yield* onDiscord();

      assert.deepStrictEqual(
        yield* live
          .remove({
            channelId,
            platformPostId: PlatformPostIdSchema.make("../synthetic"),
          })
          .pipe(Effect.flip),
        new BadRequest({ code: "invalidPlatformId" })
      );
      assert.deepStrictEqual(discord.requests(), []);
    }).pipe(Effect.scoped)
  );
});

const onTelegram = Effect.fn("test.onTelegram")(function* onTelegram(
  options: {
    readonly edit?: PendingEdit;
    readonly files?: readonly TestFile[];
  } = {}
) {
  const telegram = yield* fakeTelegramApi();

  const credentials = Layer.succeedContext(
    yield* Layer.build(
      credentialsOf({ accountId: telegramAccount, platform: "telegram" }, [
        telegramBotToken,
      ])
    )
  );

  const client = yield* telegramClientWith({
    api: telegram.url,
    credentials,
    files: options.files ?? [],
  });

  const live = yield* liveClientsOn({
    credentials,
    edits:
      options.edit === undefined
        ? new Map()
        : new Map([[changeId, options.edit]]),
    platforms: { telegramHosts: { api: telegram.url } },
  });

  return { client, live, telegram };
});

describe("deleting and editing on Telegram", () => {
  it.live("deletes every message of an album at once", () =>
    Effect.gen(function* album() {
      const one = testFile("image", 1024);
      const two = testFile("image", 1024);

      const { client, live, telegram } = yield* onTelegram({
        files: [one, two],
      });

      const platformPostId = yield* idOf(
        yield* client.publish(
          yield* outgoing({
            accountId: telegramAccount,
            media: [attached(one), attached(two)],
          })
        )
      );

      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "removed"
      );
      assert.deepStrictEqual(telegram.messages(), []);
      assert.lengthOf(telegram.calls("deleteMessages"), 1);
    }).pipe(Effect.scoped)
  );

  it.live(
    "refuses to delete a message older than 48 hours, as Telegram does",
    () =>
      Effect.gen(function* old() {
        const { client, live, telegram } = yield* onTelegram();

        const platformPostId = yield* idOf(
          yield* client.publish(yield* outgoing({ accountId: telegramAccount }))
        );

        telegram.age();

        assert.deepStrictEqual(
          yield* live.remove({ channelId, platformPostId }).pipe(Effect.flip),
          new BadRequest({ code: "telegram400" })
        );
        assert.lengthOf(telegram.messages(), 1);
      }).pipe(Effect.scoped)
  );

  it.live("edits a text as a text, and a caption as a caption", () =>
    Effect.gen(function* edits() {
      const image = testFile("image", 1024);

      const { client, live, telegram } = yield* onTelegram({
        edit: { options: Option.none(), text: "Corrected" },
        files: [image],
      });

      const text = yield* idOf(
        yield* client.publish(yield* outgoing({ accountId: telegramAccount }))
      );

      const photo = yield* idOf(
        yield* client.publish(
          yield* outgoing({
            accountId: telegramAccount,
            media: [attached(image)],
          })
        )
      );

      yield* live.edit({ changeId, channelId, platformPostId: text });
      yield* live.edit({ changeId, channelId, platformPostId: photo });

      assert.lengthOf(telegram.calls("editMessageText"), 1);
      assert.lengthOf(telegram.calls("editMessageCaption"), 1);
      assert.deepStrictEqual(
        telegram.messages().map((message) => message.text),
        ["Corrected", "Corrected"]
      );
    }).pipe(Effect.scoped)
  );

  it.live("says an edit's 400 may be the same text again", () =>
    Effect.gen(function* same() {
      const { client, live, telegram } = yield* onTelegram({
        edit: { options: Option.none(), text: "Corrected" },
      });

      const platformPostId = yield* idOf(
        yield* client.publish(yield* outgoing({ accountId: telegramAccount }))
      );

      telegram.script("editMessageText", [
        telegram.failed(400, "Bad Request: message is not modified"),
      ]);

      assert.deepStrictEqual(
        yield* live
          .edit({ changeId, channelId, platformPostId })
          .pipe(Effect.flip),
        new BadRequest({ code: "editRefusedOrSame" })
      );
    }).pipe(Effect.scoped)
  );

  it.live("says an edit's 5xx may have reached Telegram", () =>
    Effect.gen(function* serverError() {
      const { client, live, telegram } = yield* onTelegram({
        edit: { options: Option.none(), text: "Corrected" },
      });

      const platformPostId = yield* idOf(
        yield* client.publish(yield* outgoing({ accountId: telegramAccount }))
      );

      telegram.script("editMessageText", [telegram.failed(502, "Bad Gateway")]);

      assert.deepStrictEqual(
        yield* live
          .edit({ changeId, channelId, platformPostId })
          .pipe(Effect.flip),
        new PlatformUnavailable({ code: unansweredAfterSending })
      );
    }).pipe(Effect.scoped)
  );

  it.live("says an edit that never left did not reach Telegram", () =>
    Effect.gen(function* refused() {
      // Nothing listens on the port: the connection is refused.
      const credentials = Layer.succeedContext(
        yield* Layer.build(
          credentialsOf({ accountId: telegramAccount, platform: "telegram" }, [
            telegramBotToken,
          ])
        )
      );

      const live = yield* liveClientsOn({
        credentials,
        edits: new Map([[changeId, { options: Option.none(), text: "New" }]]),
        platforms: { telegramHosts: { api: "http://127.0.0.1:9" } },
      });

      assert.deepStrictEqual(
        yield* live
          .edit({
            changeId,
            channelId,
            platformPostId: PlatformPostIdSchema.make("t:1"),
          })
          .pipe(Effect.flip),
        new PlatformUnavailable()
      );
    }).pipe(Effect.scoped)
  );

  it.live("asks nothing of an id that is not a post of Peal's", () =>
    Effect.gen(function* invalid() {
      const { live, telegram } = yield* onTelegram();

      assert.deepStrictEqual(
        yield* live
          .remove({
            channelId,
            platformPostId: PlatformPostIdSchema.make("x:1"),
          })
          .pipe(Effect.flip),
        new BadRequest({ code: "invalidPlatformId" })
      );
      assert.deepStrictEqual(telegram.requests(), []);
    }).pipe(Effect.scoped)
  );
});

describe(sentUnanswered, () => {
  const request = HttpClientRequest.post("http://127.0.0.1:9/");

  it("takes a request that timed out as one that may have reached the platform", () => {
    const timedOut = new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({
        cause: new Cause.TimeoutError("Operation timed out"),
        request,
      }),
    });

    assert.deepStrictEqual(
      Effect.runSync(Effect.flip(sentUnanswered(timedOut))),
      new PlatformUnavailable({ code: unansweredAfterSending })
    );
  });

  it("takes any other transport error as one that may never have left", () => {
    const refused = new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({
        cause: new Error("connect ECONNREFUSED"),
        request,
      }),
    });

    assert.deepStrictEqual(
      Effect.runSync(Effect.flip(sentUnanswered(refused))),
      new PlatformUnavailable()
    );
  });
});
