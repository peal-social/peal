import { Effect, Option } from "effect";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import type { OwnComposerEndpoint } from "#assistant/application/ports/own-composer.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import {
  asCompositionProvider,
  capabilityAddressOf,
} from "#assistant/domain/ai-capability.ts";
import { isSandboxAddress } from "#assistant/domain/composition-provider.ts";
import type { CompositionProviderId } from "#assistant/domain/composition-provider.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * The workspace's choice for slide videos, opened: `notSet` when it chose
 * none (or a service this release composes nothing with), `keyUnreadable`
 * when the chosen service's key no longer opens, else the endpoint to
 * call and whether it is the service's sandbox.
 */
export type OpenedCompositionUse =
  | { readonly _tag: "notSet" }
  | {
      readonly _tag: "keyUnreadable";
      readonly provider: CompositionProviderId;
      readonly sandbox: boolean;
    }
  | {
      readonly _tag: "open";
      readonly endpoint: OwnComposerEndpoint;
      readonly sandbox: boolean;
    };

const notSet: OpenedCompositionUse = { _tag: "notSet" };

export const openCompositionUse = (workspaceId: WorkspaceId) =>
  Effect.gen(function* openingCompositionUse() {
    const chosen = (yield* CapabilityModels.use((models) =>
      models.list(workspaceId)
    )).find((each) => each.capability === "composition");

    const provider =
      chosen === undefined ? null : asCompositionProvider(chosen.provider);

    if (provider === null) {
      return notSet;
    }

    const connection = yield* ProviderConnections.use((connections) =>
      connections.open(workspaceId, provider)
    );

    if (Option.isNone(connection)) {
      return notSet;
    }

    const { apiKey, settings } = connection.value;
    const sandbox = isSandboxAddress(provider, settings.baseUrl);

    const opened: OpenedCompositionUse = Option.match(apiKey, {
      onNone: () => ({ _tag: "keyUnreadable", provider, sandbox }),
      onSome: (key) => ({
        _tag: "open",
        endpoint: {
          apiKey: key,
          baseUrl: ProviderAddressSchema.make(
            capabilityAddressOf(provider, "composition", settings.baseUrl)
          ),
          provider,
        },
        sandbox,
      }),
    });

    return opened;
  });
