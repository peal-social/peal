import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";

const inStudio = ["--workspace", "studio"];

const syntheticKey = "synthetic-workspace-provider-key";

// peal assistant providers and peal assistant models, in the studio.
const providers = (...rest: readonly string[]) => [
  "assistant",
  "providers",
  ...rest,
  ...inStudio,
];

const models = (...rest: readonly string[]) => [
  "assistant",
  "models",
  ...rest,
  ...inStudio,
];

describe("peal assistant providers and models", () => {
  it.effect(
    "connects a provider at its own address, the key piped in, and never prints it",
    () =>
      Effect.gen(function* connects() {
        const session = yield* signedIn();

        const printed = yield* session
          .piping(`${syntheticKey}\n`)
          .printed(providers("connect", "anthropic"));

        assert.include(
          printed,
          "Connected Anthropic to Studio, at https://api.anthropic.com"
        );
        assert.notInclude(printed, syntheticKey);

        const { changes, connections } = yield* Ref.get(session.studio.state);

        assert.strictEqual(connections[0]?.apiKey, syntheticKey);
        assert.include(
          changes,
          "provider:connect:anthropic:https://api.anthropic.com"
        );

        const listed = yield* session.printed(providers("list"));

        assert.include(listed, "Anthropic (anthropic)");
        assert.include(listed, "saved (never shown)");
        assert.notInclude(listed, syntheticKey);
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "refuses another endpoint without its address, and a key not kept",
    () =>
      Effect.gen(function* refuses() {
        const session = yield* signedIn();

        assert.include(
          yield* session
            .piping(syntheticKey)
            .refused(providers("connect", "openai-compatible")),
          "The address is not a URL"
        );
        assert.include(
          yield* session.refused(providers("connect", "openai", "--keep-key")),
          "Give the key again, on standard input."
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "chooses a model on a connected provider, lists the uses and unsets one",
    () =>
      Effect.gen(function* chooses() {
        const session = yield* signedIn();

        assert.include(
          yield* session.refused(
            models(
              "set",
              "text",
              "--provider",
              "anthropic",
              "--model",
              "claude-sonnet-5-5"
            )
          ),
          "connect it first with peal assistant providers connect"
        );

        yield* session
          .piping(syntheticKey)
          .printed(providers("connect", "anthropic"));

        assert.include(
          yield* session.refused(
            models(
              "set",
              "image",
              "--provider",
              "anthropic",
              "--model",
              "claude-sonnet-5-5"
            )
          ),
          "That provider does not offer this use"
        );

        assert.include(
          yield* session.printed(
            models(
              "set",
              "text",
              "--provider",
              "anthropic",
              "--model",
              "claude-sonnet-5-5"
            )
          ),
          "Studio now uses Anthropic's claude-sonnet-5-5 for text"
        );

        const listed = yield* session.printed(models("list"));

        assert.include(
          listed,
          "Text: Anthropic (anthropic), claude-sonnet-5-5"
        );
        assert.include(listed, "Images: off");

        yield* session.printed(models("unset", "text"));

        assert.include(
          yield* session.printed(models("list")),
          "Text: the server's model"
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("tests a provider, and disconnects it once asked", () =>
    Effect.gen(function* tests() {
      const session = yield* signedIn();

      assert.include(
        yield* session.refused(providers("test", "anthropic")),
        "The workspace has not connected that provider"
      );

      yield* session
        .piping(syntheticKey)
        .printed(providers("connect", "anthropic"));

      assert.include(
        yield* session.printed(providers("test", "anthropic")),
        "Anthropic answered with a suggestion the assistant can use."
      );
      assert.include(
        (yield* Ref.get(session.studio.state)).changes,
        "provider:test:anthropic:claude-sonnet-5-5"
      );

      yield* session.printed(providers("disconnect", "anthropic", "--yes"));

      assert.deepStrictEqual(
        (yield* Ref.get(session.studio.state)).connections,
        []
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "connects Shotstack's sandbox and chooses it for slide videos without a model",
    () =>
      Effect.gen(function* composes() {
        const session = yield* signedIn();

        assert.include(
          yield* session
            .piping(syntheticKey)
            .refused(providers("connect", "anthropic", "--sandbox")),
          "Anthropic has no sandbox"
        );

        assert.include(
          yield* session
            .piping(syntheticKey)
            .printed(providers("connect", "shotstack", "--sandbox")),
          "Connected Shotstack to Studio, at https://api.shotstack.io/edit/stage"
        );

        assert.include(
          yield* session.refused(
            models("set", "text", "--provider", "shotstack")
          ),
          "--model is required for text"
        );

        assert.include(
          yield* session.printed(
            models("set", "composition", "--provider", "shotstack")
          ),
          "Studio now composes slide videos with Shotstack"
        );

        const { changes } = yield* Ref.get(session.studio.state);

        assert.include(changes, "model:set:composition:shotstack:edit");
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
