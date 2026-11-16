import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted, Result } from "effect";

import { metaWebhookVerifyTokenConfig } from "#shared/infrastructure/platforms/meta-apps.ts";

// `META_WEBHOOK_VERIFY_TOKEN`, read once when the server starts: the token
// Meta's dashboard is given to check that the events' address is Peal's.
// Unset, Peal takes no event; one too short to guess stops the server.

const read = (env: Record<string, string>) =>
  metaWebhookVerifyTokenConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Effect.map(Option.map(Redacted.value)),
    Effect.result
  );

const token = "synthetic-verify-token-of-at-least-32-characters";

describe("Meta's webhook verify token", () => {
  it.effect("is none when unset or blank", () =>
    Effect.gen(function* unset() {
      assert.deepStrictEqual(yield* read({}), Result.succeed(Option.none()));
      assert.deepStrictEqual(
        yield* read({ META_WEBHOOK_VERIFY_TOKEN: "   " }),
        Result.succeed(Option.none())
      );
    })
  );

  it.effect("is read as written", () =>
    Effect.gen(function* written() {
      assert.deepStrictEqual(
        yield* read({ META_WEBHOOK_VERIFY_TOKEN: token }),
        Result.succeed(Option.some(token))
      );
    })
  );

  it.effect("stops the server when shorter than 32 characters", () =>
    Effect.gen(function* short() {
      const result = yield* read({
        META_WEBHOOK_VERIFY_TOKEN: "synthetic-too-short",
      });

      assert.isTrue(Result.isFailure(result));

      if (Result.isFailure(result)) {
        assert.strictEqual(result.failure._tag, "InvalidMetaSettings");
        assert.include(result.failure.message, "META_WEBHOOK_VERIFY_TOKEN");
        assert.notInclude(result.failure.message, "synthetic-too-short");
      }
    })
  );
});
