import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Result } from "effect";

import { humanAgentConfig } from "#engagement/infrastructure/human-agent-config.ts";

// `PEAL_META_HUMAN_AGENT`, read once when the server starts: Meta reviews
// its Human Agent feature apart, so a person's answer past the 24 hours
// is off until the operator says the app holds it.

const read = (env: Record<string, string>) =>
  humanAgentConfig.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
    Effect.result
  );

describe("Meta's Human Agent setting", () => {
  it.effect("is off unless set", () =>
    Effect.gen(function* off() {
      assert.deepStrictEqual(yield* read({}), Result.succeed(false));
      assert.deepStrictEqual(
        yield* read({ PEAL_META_HUMAN_AGENT: "false" }),
        Result.succeed(false)
      );
      assert.deepStrictEqual(
        yield* read({ PEAL_META_HUMAN_AGENT: "" }),
        Result.succeed(false)
      );
    })
  );

  it.effect("is on when set to true", () =>
    Effect.gen(function* on() {
      assert.deepStrictEqual(
        yield* read({ PEAL_META_HUMAN_AGENT: "true" }),
        Result.succeed(true)
      );
    })
  );

  it.effect("stops the server for anything else", () =>
    Effect.gen(function* refused() {
      for (const value of ["maybe", "1", "on", "yes", "TRUE"]) {
        assert.isTrue(
          Result.isFailure(yield* read({ PEAL_META_HUMAN_AGENT: value })),
          value
        );
      }
    })
  );
});
