import { Effect, Layer, Option } from "effect";

import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ImageProviders } from "#assistant/application/ports/image-providers.ts";
import type { OpenedImageProvider } from "#assistant/application/ports/image-providers.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { asImageProvider } from "#assistant/domain/ai-capability.ts";
import { ImageProviderSettings } from "#assistant/domain/image-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

import { openedUse, removedUse, savedUse } from "./capability-uses.ts";

/**
 * ImageProviders, the deprecated endpoints' view of the workspace's
 * images: the provider and model it chose for `image`, at its
 * connection's address, with the connection's key. A choice of a
 * provider that makes no image (none can be saved) reads as none.
 */
export const DrizzleImageProvidersLive = Layer.effect(
  ImageProviders,
  Effect.gen(function* DrizzleImageProviders() {
    const ports = yield* Effect.context<
      CapabilityModels | ProviderConnections
    >();

    const open = (workspaceId: WorkspaceId) =>
      openedUse(workspaceId, "image").pipe(
        Effect.map(
          Option.flatMap(({ apiKey, baseUrl, model, updatedAt }) => {
            const provider = asImageProvider(model.provider);

            return provider === null
              ? Option.none<OpenedImageProvider>()
              : Option.some({
                  apiKey,
                  settings: new ImageProviderSettings({
                    baseUrl,
                    model: model.model,
                    provider,
                    updatedAt,
                  }),
                });
          })
        ),
        Effect.provideContext(ports),
        Effect.withSpan("ImageProviders.open")
      );

    return ImageProviders.of({
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
        removedUse(workspaceId, "image").pipe(
          Effect.provideContext(ports),
          Effect.withSpan("ImageProviders.remove")
        ),
      save: (workspaceId, settings, key) =>
        savedUse(
          workspaceId,
          {
            baseUrl: settings.baseUrl,
            capability: "image",
            model: settings.model,
            provider: settings.provider,
            updatedAt: settings.updatedAt,
          },
          key
        ).pipe(
          Effect.provideContext(ports),
          Effect.withSpan("ImageProviders.save")
        ),
    });
  })
);
