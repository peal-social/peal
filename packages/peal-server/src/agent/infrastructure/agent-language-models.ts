import { Context } from "effect";
import type { Effect, Option } from "effect";
import type { LanguageModel } from "effect/ai";

import type { ProviderNotReached } from "#agent/infrastructure/provider-not-reached.ts";
import type { OwnTextEndpoint } from "#assistant/application/ports/own-writing-model.ts";

/**
 * The language models the agent talks to: the server's own
 * (`PEAL_AI_PROVIDER`, none when it is off), and a workspace's own text
 * provider, at the address a member typed, which the outbound guard checks
 * before the model is built and on every request it sends. Neither sends
 * Peal's trace context to the provider.
 */
export class AgentLanguageModels extends Context.Service<
  AgentLanguageModels,
  {
    readonly server: Option.Option<LanguageModel.LanguageModel>;
    readonly own: (
      endpoint: OwnTextEndpoint
    ) => Effect.Effect<LanguageModel.LanguageModel, ProviderNotReached>;
  }
>()("peal-server/agent/infrastructure/AgentLanguageModels") {}
