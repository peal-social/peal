import { Effect, Layer } from "effect";
import { LanguageModel } from "effect/ai";

import type { WritingModel } from "#assistant/application/ports/writing-model.ts";
import { kindOfProvider } from "#assistant/domain/text-provider.ts";
import { languageModelOn } from "#assistant/infrastructure/ai-sdk/language-model.ts";
import { textModelOf } from "#assistant/infrastructure/ai-sdk/models.ts";
import type {
  ProviderFetch,
  TextModelSettings,
} from "#assistant/infrastructure/ai-sdk/models.ts";
import { assistantProviderConfig } from "#assistant/infrastructure/assistant-settings.ts";
import type { AssistantProvider } from "#assistant/infrastructure/assistant-settings.ts";
import { languageModelWritingModel } from "#assistant/infrastructure/language-model-writing-model.ts";
import { UnavailableWritingModelLive } from "#assistant/infrastructure/unavailable-writing-model.ts";

/**
 * The most tokens an answer may take: a translated LinkedIn post, the
 * longest the assistant writes, in a JSON object, with room. It bounds what
 * each request costs.
 */
const maxOutputTokens = 4096;

/**
 * The LanguageModel of a provider's settings, its requests sent through
 * `fetch`: plain fetch for the server's own provider, the guarded one
 * (`publicFetchWith`) for a workspace's. Each answer takes at most
 * `maxOutputTokens`. A fetch sends no trace context: Peal's stays with
 * Peal.
 */
export const languageModelOf = (
  settings: TextModelSettings,
  fetch: ProviderFetch
): Effect.Effect<LanguageModel.LanguageModel> =>
  languageModelOn(textModelOf(settings, fetch), {
    kind: kindOfProvider(settings.provider),
    maxOutputTokens,
  });

type Configured = Extract<AssistantProvider, { readonly _tag: "On" }>;

// The server's own provider, which the operator named: reached with
// plain fetch, not through the outbound guard. Its requests time out in
// languageModelWritingModel, which tells a timeout from an unreachable
// provider: the provider may have run a request that timed out.
const configured = (provider: Configured) =>
  languageModelWritingModel({
    model: provider.model,
    provider: provider.provider,
  }).pipe(
    Layer.provide(
      Layer.effect(
        LanguageModel.LanguageModel,
        languageModelOf(provider, globalThis.fetch)
      )
    )
  );

/** The WritingModel for a provider's settings. */
export const writingModelFor = (
  provider: AssistantProvider
): Layer.Layer<WritingModel> =>
  provider._tag === "Off" ? UnavailableWritingModelLive : configured(provider);

/** The language model the environment names, or none (see assistant-settings.ts). */
export const WritingModelLive = Layer.unwrap(
  assistantProviderConfig.pipe(Effect.map(writingModelFor))
);
