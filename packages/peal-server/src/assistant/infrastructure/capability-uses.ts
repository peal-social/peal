import { DateTime, Effect, Option } from "effect";
import type { Redacted } from "effect";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import {
  capabilityAddressOf,
  connectionAddressOf,
} from "#assistant/domain/ai-capability.ts";
import type { AiCapability } from "#assistant/domain/ai-capability.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

// The text and image provider endpoints, deprecated, read and write the
// workspace's choice for one use and its connection as one provider did.

/**
 * A use's choice with its connection, opened: what the text and image
 * provider views read. None when the use is not chosen.
 */
export const openedUse = (workspaceId: WorkspaceId, capability: AiCapability) =>
  Effect.gen(function* openingUse() {
    const models = yield* CapabilityModels;
    const connections = yield* ProviderConnections;

    const chosen = (yield* models.list(workspaceId)).find(
      (each) => each.capability === capability
    );

    if (chosen === undefined) {
      return Option.none();
    }

    const connection = yield* connections.open(workspaceId, chosen.provider);

    return connection.pipe(
      Option.map(({ apiKey, settings }) => ({
        apiKey,
        baseUrl: ProviderAddressSchema.make(
          capabilityAddressOf(chosen.provider, capability, settings.baseUrl)
        ),
        model: chosen,
        // The later of the two: a new key or address changes the use too.
        updatedAt: DateTime.max(chosen.updatedAt, settings.updatedAt),
      }))
    );
  });

/**
 * Keeps a use as the text and image provider endpoints set it: its
 * provider connected at the use's address, less what the use adds to it,
 * with this key, then the use on it.
 */
export const savedUse = (
  workspaceId: WorkspaceId,
  use: {
    readonly baseUrl: string;
    readonly capability: AiCapability;
    readonly model: CapabilityModelSettings["model"];
    readonly provider: CapabilityModelSettings["provider"];
    readonly updatedAt: DateTime.Utc;
  },
  key: Redacted.Redacted
) =>
  Effect.gen(function* savingUse() {
    const models = yield* CapabilityModels;
    const connections = yield* ProviderConnections;

    yield* connections.save(
      workspaceId,
      new ProviderConnectionSettings({
        baseUrl: ProviderAddressSchema.make(
          connectionAddressOf(use.provider, use.capability, use.baseUrl)
        ),
        provider: use.provider,
        updatedAt: use.updatedAt,
      }),
      key
    );
    yield* models.set(
      workspaceId,
      new CapabilityModelSettings({
        capability: use.capability,
        model: use.model,
        provider: use.provider,
        updatedAt: use.updatedAt,
      })
    );
  });

/**
 * Removes a use as the text and image provider endpoints remove it: the
 * use, and its provider's connection when no other use is on it.
 */
export const removedUse = (
  workspaceId: WorkspaceId,
  capability: AiCapability
) =>
  Effect.gen(function* removingUse() {
    const models = yield* CapabilityModels;
    const connections = yield* ProviderConnections;
    const chosen = yield* models.list(workspaceId);
    const mine = chosen.find((each) => each.capability === capability);

    yield* models.unset(workspaceId, capability);

    if (
      mine !== undefined &&
      !chosen.some(
        (each) =>
          each.capability !== capability && each.provider === mine.provider
      )
    ) {
      yield* connections.remove(workspaceId, mine.provider);
    }
  });
