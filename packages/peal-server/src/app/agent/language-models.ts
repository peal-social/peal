import { Duration, Effect, Layer, Option } from "effect";

import { roundTimeout } from "#agent/domain/run-limits.ts";
import { AgentLanguageModels } from "#agent/infrastructure/agent-language-models.ts";
import { ProviderNotReached } from "#agent/infrastructure/provider-not-reached.ts";
import type { OwnTextEndpoint } from "#assistant/application/ports/own-writing-model.ts";
import { assistantProviderConfig } from "#assistant/infrastructure/assistant-settings.ts";
import { languageModelOf } from "#assistant/infrastructure/writing-model-live.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

/**
 * The most one round's streamed answer may carry from a workspace's own
 * provider: its events for 4,096 tokens, with room.
 */
const maxRoundBytes = 2 * 1024 * 1024;

// The provider's settings as the AI SDK's adapters take them.
const settingsOf = (endpoint: OwnTextEndpoint) => ({
  apiKey: Option.some(endpoint.apiKey),
  baseUrl: endpoint.baseUrl,
  model: endpoint.model,
  provider: endpoint.provider,
});

/**
 * AgentLanguageModels on the writing assistant's adapters (the AI SDK's,
 * under effect/ai): the server's model as `PEAL_AI_PROVIDER` names it, on
 * plain fetch, and a workspace's own at its address, checked by the
 * outbound guard before the round and on every request, through the
 * guarded fetch (no redirect, the answer bounded). Neither sends Peal's
 * trace context. A workspace's model is built for each round, its key
 * kept no longer.
 */
export const AgentLanguageModelsLive = Layer.effect(
  AgentLanguageModels,
  Effect.gen(function* AgentLanguageModelsLive() {
    const provider = yield* assistantProviderConfig;
    const guard = yield* OutboundGuard;

    const fetch = yield* publicFetchWith({
      maxResponseBytes: maxRoundBytes,
      timeout: Duration.sum(roundTimeout, Duration.seconds(1)),
    });

    const server =
      provider._tag === "Off"
        ? Option.none()
        : Option.some(yield* languageModelOf(provider, globalThis.fetch));

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
        Effect.andThen(languageModelOf(settingsOf(endpoint), fetch))
      );

    return AgentLanguageModels.of({ own, server });
  })
).pipe(Layer.provide(OutboundGuard.layer));
