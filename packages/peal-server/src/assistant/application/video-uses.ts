import { Effect, Option } from "effect";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import type { OwnVideoEndpoint } from "#assistant/application/ports/own-video-model.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import {
  asVideoProvider,
  capabilityAddressOf,
} from "#assistant/domain/ai-capability.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import type { VideoProviderId } from "#assistant/domain/video-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * The workspace's choice for videos, opened: `notSet` when it chose none
 * (or a provider this release makes no videos with), `keyUnreadable` when
 * the chosen provider's key no longer opens, else the endpoint to call.
 */
export type OpenedVideoUse =
  | { readonly _tag: "notSet" }
  | { readonly _tag: "keyUnreadable"; readonly provider: VideoProviderId }
  | { readonly _tag: "open"; readonly endpoint: OwnVideoEndpoint };

const notSet: OpenedVideoUse = { _tag: "notSet" };

export const openVideoUse = (workspaceId: WorkspaceId) =>
  Effect.gen(function* openingVideoUse() {
    const chosen = (yield* CapabilityModels.use((models) =>
      models.list(workspaceId)
    )).find((each) => each.capability === "video");

    const provider =
      chosen === undefined ? null : asVideoProvider(chosen.provider);

    if (chosen === undefined || provider === null) {
      return notSet;
    }

    const connection = yield* ProviderConnections.use((connections) =>
      connections.open(workspaceId, provider)
    );

    if (Option.isNone(connection)) {
      return notSet;
    }

    const { apiKey, settings } = connection.value;

    const opened: OpenedVideoUse = Option.match(apiKey, {
      onNone: () => ({ _tag: "keyUnreadable", provider }),
      onSome: (key) => ({
        _tag: "open",
        endpoint: {
          apiKey: key,
          baseUrl: ProviderAddressSchema.make(
            capabilityAddressOf(provider, "video", settings.baseUrl)
          ),
          model: chosen.model,
          provider,
        },
      }),
    });

    return opened;
  });
