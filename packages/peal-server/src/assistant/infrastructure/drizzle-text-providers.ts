import { Effect, Layer, Option } from "effect";

import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { TextProviders } from "#assistant/application/ports/text-providers.ts";
import type { OpenedTextProvider } from "#assistant/application/ports/text-providers.ts";
import { asTextProvider } from "#assistant/domain/ai-capability.ts";
import {
  kindOfProvider,
  TextProviderSettings,
} from "#assistant/domain/text-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

import { openedUse, removedUse, savedUse } from "./capability-uses.ts";

/**
 * TextProviders, the deprecated endpoints' view of the workspace's text:
 * the provider and model it chose for `text`, at its connection's address
 * (with what text adds to it), with the connection's key.
 */
export const DrizzleTextProvidersLive = Layer.effect(
  TextProviders,
  Effect.gen(function* DrizzleTextProviders() {
    const ports = yield* Effect.context<
      CapabilityModels | ProviderConnections
    >();

    const open = (workspaceId: WorkspaceId) =>
      openedUse(workspaceId, "text").pipe(
        Effect.map(
          Option.flatMap(({ apiKey, baseUrl, model, updatedAt }) => {
            // Only a provider that writes text is ever chosen for it.
            const provider = asTextProvider(model.provider);

            return provider === null
              ? Option.none()
              : Option.some<OpenedTextProvider>({
                  apiKey,
                  settings: new TextProviderSettings({
                    baseUrl,
                    kind: kindOfProvider(provider),
                    model: model.model,
                    provider,
                    updatedAt,
                  }),
                });
          })
        ),
        Effect.provideContext(ports),
        Effect.withSpan("TextProviders.open")
      );

    return TextProviders.of({
      find: (workspaceId) =>
        open(workspaceId).pipe(
          Effect.map(
            Option.map(({ apiKey, settings }) => ({
              keyUnreadable: Option.isNone(apiKey),
              settings,
            }))
          )
        ),
      open,
      remove: (workspaceId) =>
        removedUse(workspaceId, "text").pipe(
          Effect.provideContext(ports),
          Effect.withSpan("TextProviders.remove")
        ),
      save: (workspaceId, settings, key) =>
        savedUse(
          workspaceId,
          {
            baseUrl: settings.baseUrl,
            capability: "text",
            model: settings.model,
            provider: settings.provider,
            updatedAt: settings.updatedAt,
          },
          key
        ).pipe(
          Effect.provideContext(ports),
          Effect.withSpan("TextProviders.save")
        ),
    });
  })
);
