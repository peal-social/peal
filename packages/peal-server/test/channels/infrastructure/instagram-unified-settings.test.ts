import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Result } from "effect";

import { channelPlatformsConfig } from "#channels/infrastructure/platforms/channel-platform-settings.ts";

// `META_INSTAGRAM_CONFIG_ID`, read once when the server starts: the
// configuration Meta's Unified login for Instagram opens with, on the main
// app. Unset or blank, the way in is not offered; without the main app, or
// not an id, it stops the server.

const mainApp = {
  META_APP_ID: "1234567890",
  META_APP_SECRET: "synthetic-meta-secret",
  PUBLIC_URL: "https://peal.test",
};

const read = (env: Record<string, string>) =>
  channelPlatformsConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Effect.map(({ instagramUnified }) => instagramUnified),
    Effect.result
  );

const failureOf = Effect.fnUntraced(function* failureOf(
  env: Record<string, string>
) {
  const result = yield* read(env);

  assert.isTrue(Result.isFailure(result));

  return Result.isFailure(result) ? result.failure : undefined;
});

describe("Unified login's setting", () => {
  it.effect("is off when unset or blank", () =>
    Effect.gen(function* unset() {
      assert.deepStrictEqual(
        yield* read(mainApp),
        Result.succeed(Option.none())
      );
      assert.deepStrictEqual(
        yield* read({ ...mainApp, META_INSTAGRAM_CONFIG_ID: "  " }),
        Result.succeed(Option.none())
      );
    })
  );

  it.effect("opens the main app with the configuration, trimmed", () =>
    Effect.gen(function* set() {
      const result = yield* read({
        ...mainApp,
        META_INSTAGRAM_CONFIG_ID: " 1300000000000001 ",
      });

      assert.isTrue(Result.isSuccess(result));

      const unified = Result.isSuccess(result)
        ? Option.getOrUndefined(result.success)
        : undefined;

      assert.strictEqual(unified?.configId, "1300000000000001");
      assert.strictEqual(unified?.app.appId, mainApp.META_APP_ID);
    })
  );

  it.effect("stops the server without the main app", () =>
    Effect.gen(function* withoutApp() {
      const failure = yield* failureOf({
        META_INSTAGRAM_CONFIG_ID: "1300000000000001",
        PUBLIC_URL: "https://peal.test",
      });

      assert.strictEqual(failure?._tag, "InvalidMetaSettings");
      assert.include(failure?.message, "META_APP_ID");
    })
  );

  it.effect("stops the server on anything but an id", () =>
    Effect.gen(function* malformed() {
      for (const value of [
        "synthetic-config",
        "13000000000000a1",
        "1".repeat(33),
      ]) {
        const failure = yield* failureOf({
          ...mainApp,
          META_INSTAGRAM_CONFIG_ID: value,
        });

        assert.strictEqual(failure?._tag, "InvalidMetaSettings");
        assert.include(failure?.message, "META_INSTAGRAM_CONFIG_ID");
        assert.notInclude(failure?.message, value);
      }
    })
  );
});
