import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Result } from "effect";

import { inboxMessagesConfig } from "#shared/infrastructure/inbox-messages.ts";

// `PEAL_INBOX_MESSAGES`, read once when the server starts: direct
// messages are private correspondence, read on no platform unless named,
// and a name the inbox cannot read stops the server.

const mainApp = {
  META_APP_ID: "1000000000000001",
  META_APP_SECRET: "synthetic-meta-secret",
};

const instagramApp = {
  INSTAGRAM_APP_ID: "1000000000000002",
  INSTAGRAM_APP_SECRET: "synthetic-instagram-secret",
};

const verifyToken = {
  META_WEBHOOK_VERIFY_TOKEN: "synthetic-verify-token-0000000000000000",
};

const read = (env: Record<string, string>) =>
  inboxMessagesConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Effect.map((platforms) => [...platforms].toSorted()),
    Effect.result
  );

describe("the inbox's direct messages", () => {
  it.effect("are read on no platform unless named", () =>
    Effect.gen(function* off() {
      assert.deepStrictEqual(yield* read({}), Result.succeed([]));
      assert.deepStrictEqual(
        yield* read({ PEAL_INBOX_MESSAGES: " , " }),
        Result.succeed([])
      );
    })
  );

  it.effect("are read on the platforms named", () =>
    Effect.gen(function* named() {
      assert.deepStrictEqual(
        yield* read({ PEAL_INBOX_MESSAGES: "mastodon" }),
        Result.succeed(["mastodon"])
      );
      assert.deepStrictEqual(
        yield* read({ PEAL_INBOX_MESSAGES: " bluesky , mastodon " }),
        Result.succeed(["bluesky", "mastodon"])
      );
    })
  );

  it.effect("stop the server for a platform they are not read on", () =>
    Effect.gen(function* refused() {
      const result = yield* read({ PEAL_INBOX_MESSAGES: "mastodon,threads" });

      assert.isTrue(Result.isFailure(result));

      if (Result.isFailure(result)) {
        assert.strictEqual(result.failure._tag, "InvalidInboxSettings");
        assert.include(
          result.failure.message,
          "mastodon, bluesky, facebook and instagram"
        );
      }
    })
  );

  it.effect(
    "are read on Facebook Pages and Instagram with the apps and the verify token",
    () =>
      Effect.gen(function* meta() {
        assert.deepStrictEqual(
          yield* read({
            ...mainApp,
            ...verifyToken,
            PEAL_INBOX_MESSAGES: "facebook,instagram",
          }),
          Result.succeed(["facebook", "instagram"])
        );
        assert.deepStrictEqual(
          yield* read({
            ...instagramApp,
            ...verifyToken,
            PEAL_INBOX_MESSAGES: "instagram",
          }),
          Result.succeed(["instagram"])
        );
      })
  );

  it.effect(
    "stop the server for a Meta platform without its app or the verify token",
    () =>
      Effect.gen(function* refusedMeta() {
        const refusals = [
          [
            {
              ...instagramApp,
              ...verifyToken,
              PEAL_INBOX_MESSAGES: "facebook",
            },
            "META_APP_ID",
          ],
          [
            { ...verifyToken, PEAL_INBOX_MESSAGES: "instagram" },
            "INSTAGRAM_APP_ID",
          ],
          [
            { ...mainApp, PEAL_INBOX_MESSAGES: "facebook" },
            "META_WEBHOOK_VERIFY_TOKEN",
          ],
          [
            { ...instagramApp, PEAL_INBOX_MESSAGES: "instagram" },
            "META_WEBHOOK_VERIFY_TOKEN",
          ],
        ] as const;

        for (const [env, named] of refusals) {
          const result = yield* read(env);

          assert.isTrue(Result.isFailure(result));

          if (Result.isFailure(result)) {
            assert.strictEqual(result.failure._tag, "InvalidInboxSettings");
            assert.include(result.failure.message, named);
          }
        }
      })
  );
});
