import { Duration, Effect, Layer, Match, Option } from "effect";
import { LanguageModel } from "effect/ai";
import { FetchHttpClient, HttpClient } from "effect/http";

import { roundTimeout } from "#agent/domain/run-limits.ts";
import { AgentLanguageModels } from "#agent/infrastructure/agent-language-models.ts";
import { ProviderNotReached } from "#agent/infrastructure/provider-not-reached.ts";
import type { OwnTextEndpoint } from "#assistant/application/ports/own-writing-model.ts";
import { assistantProviderConfig } from "#assistant/infrastructure/assistant-settings.ts";
import { languageModelOf } from "#assistant/infrastructure/writing-model-live.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { publicLibraryHttpClientWith } from "#shared/infrastructure/platforms/public-http.ts";

/**
 * The most one round's streamed answer may carry from a workspace's own
 * provider: its events for 4,096 tokens, with room.
 */
const maxRoundBytes = 2 * 1024 * 1024;

// The provider's settings as the server's own adapters take them.
const providerOf = (endpoint: OwnTextEndpoint) =>
  Match.value(endpoint.kind).pipe(
    Match.when("anthropic", () => ({
      _tag: "Anthropic" as const,
      apiKey: endpoint.apiKey,
      baseUrl: Option.some<string>(endpoint.baseUrl),
      model: endpoint.model,
    })),
    Match.when("openai-compatible", () => ({
      _tag: "OpenAiCompatible" as const,
      apiKey: Option.some(endpoint.apiKey),
      baseUrl: endpoint.baseUrl,
      model: endpoint.model,
    })),
    Match.exhaustive
  );

const modelOf = (
  layer: Layer.Layer<LanguageModel.LanguageModel, never, HttpClient.HttpClient>,
  http: Layer.Layer<HttpClient.HttpClient>
) =>
  Effect.service(LanguageModel.LanguageModel).pipe(
    Effect.provide(layer.pipe(Layer.provide(http)))
  );

/**
 * AgentLanguageModels on the writing assistant's provider packages: the
 * server's model as `PEAL_AI_PROVIDER` names it, on the fetch client, and
 * a workspace's own at its address, checked by the outbound guard before
 * the round and on every request, through the public client (no redirect,
 * the answer bounded). Neither sends Peal's trace context.
 */
export const AgentLanguageModelsLive = Layer.effect(
  AgentLanguageModels,
  Effect.gen(function* AgentLanguageModelsLive() {
    const provider = yield* assistantProviderConfig;
    const guard = yield* OutboundGuard;

    const client = yield* publicLibraryHttpClientWith({
      maxResponseBytes: maxRoundBytes,
      timeout: Duration.sum(roundTimeout, Duration.seconds(1)),
    });

    const guarded = Layer.succeed(HttpClient.HttpClient, client);

    const server =
      provider._tag === "Off"
        ? Option.none()
        : Option.some(
            yield* modelOf(languageModelOf(provider), FetchHttpClient.layer)
          );

    const own = (endpoint: OwnTextEndpoint) =>
      guard.check(new URL(endpoint.baseUrl)).pipe(
        // The guard's span names the host it refuses.
        Effect.withTracerEnabled(false),
        Effect.mapError(
          ({ reason }) =>
            new ProviderNotReached({
              reason:
                reason === "lookupFailed" ? "unreachable" : "providerRefused",
            })
        ),
        Effect.andThen(modelOf(languageModelOf(providerOf(endpoint)), guarded))
      );

    return AgentLanguageModels.of({ own, server });
  })
).pipe(
  Layer.provide(OutboundGuard.layer),
  Layer.provide(FetchHttpClient.layer)
);
