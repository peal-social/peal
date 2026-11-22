import { Context, Effect, Layer, Option, Ref, Stream } from "effect";
import type { Schema } from "effect";
import { AiError, LanguageModel } from "effect/ai";
import type { Prompt, Response } from "effect/ai";

import { AgentLanguageModels } from "#agent/infrastructure/agent-language-models.ts";

/** One request to the model: the parts it streams, a failure, or nothing ever. */
export type Round =
  | {
      readonly _tag: "parts";
      readonly parts: readonly Response.StreamPartEncoded[];
    }
  | { readonly _tag: "failure"; readonly reason: AiError.AiErrorReason }
  | { readonly _tag: "silence" };

const usage = { inputTokens: { total: 1 }, outputTokens: { total: 1 } };

/** A round that writes this text and stops. */
export const says = (text: string): Round => ({
  _tag: "parts",
  parts: [
    { id: "t", type: "text-start" },
    { delta: text, id: "t", type: "text-delta" },
    { id: "t", type: "text-end" },
    { reason: "stop", type: "finish", usage },
  ],
});

/** A round that calls a tool, with these parameters, and waits for its answer. */
export const calls = (
  name: string,
  params: Schema.Json,
  id = `call-${name}`
): Round => ({
  _tag: "parts",
  parts: [
    { id, name, params, type: "tool-call" },
    { reason: "tool-calls", type: "finish", usage },
  ],
});

/** A round the provider fails for this reason. */
export const fails = (reason: AiError.AiErrorReason): Round => ({
  _tag: "failure",
  reason,
});

/** A round the provider takes and never answers. */
export const silence: Round = { _tag: "silence" };

/**
 * The agent's model, as the test scripts it: each request answers the
 * next round (a text once the script ends), the title's request the
 * title, and every prompt is kept.
 */
export class FakeAgentModel extends Context.Service<
  FakeAgentModel,
  {
    readonly script: (rounds: readonly Round[]) => Effect.Effect<void>;
    readonly titled: (title: string | null) => Effect.Effect<void>;
    readonly prompts: Effect.Effect<readonly Prompt.Prompt[]>;
  }
>()("peal-server/test/agent/FakeAgentModel") {}

const failureOf = (reason: AiError.AiErrorReason) =>
  AiError.make({ method: "streamText", module: "FakeAgentModel", reason });

export const FakeAgentModelLive = Layer.effectContext(
  Effect.gen(function* FakeAgentModelLive() {
    const rounds = yield* Ref.make<readonly Round[]>([]);
    const title = yield* Ref.make<string | null>("A chat");
    const sent = yield* Ref.make<readonly Prompt.Prompt[]>([]);

    const next = Ref.modify(
      rounds,
      (left): readonly [Round, readonly Round[]] => [
        left[0] ?? says("Done."),
        left.slice(1),
      ]
    );

    const model = yield* LanguageModel.make({
      generateText: () =>
        Ref.get(title).pipe(
          Effect.flatMap((named) =>
            named === null
              ? Effect.fail(
                  failureOf(
                    new AiError.InternalProviderError({ description: "down" })
                  )
                )
              : Effect.succeed<Response.PartEncoded[]>([
                  { text: JSON.stringify({ title: named }), type: "text" },
                ])
          )
        ),
      streamText: (options) =>
        Stream.unwrap(
          Ref.update(sent, (prompts) => [...prompts, options.prompt]).pipe(
            Effect.andThen(next),
            Effect.map((round) => {
              if (round._tag === "silence") {
                return Stream.never;
              }

              return round._tag === "failure"
                ? Stream.fail(failureOf(round.reason))
                : Stream.fromIterable(round.parts);
            })
          )
        ),
    });

    return Context.make(LanguageModel.LanguageModel, model).pipe(
      Context.add(
        FakeAgentModel,
        FakeAgentModel.of({
          prompts: Ref.get(sent),
          script: (script) => Ref.set(rounds, script),
          titled: (named) => Ref.set(title, named),
        })
      )
    );
  })
);

/** The models the agent talks to: the fake, for the server and for a workspace's own. */
export const FakeLanguageModelsLive = Layer.effect(
  AgentLanguageModels,
  LanguageModel.LanguageModel.use((model) =>
    Effect.succeed(
      AgentLanguageModels.of({
        own: () => Effect.succeed(model),
        server: Option.some(model),
      })
    )
  )
);
