import { Context } from "effect";
import type { Effect } from "effect";

import type { AiCapability } from "#assistant/domain/ai-capability.ts";
import type { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * What each workspace chose for each of its uses: a provider it connected
 * and a model. Rows naming a use or a provider this release does not
 * know are left out. Every write here also deletes the workspace's rows
 * of the text and image provider tables the release before kept, as
 * `ProviderConnections`' do. A database failure is a defect.
 */
export class CapabilityModels extends Context.Service<
  CapabilityModels,
  {
    /** The workspace's choices, one at most a use, in no order. */
    readonly list: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<readonly CapabilityModelSettings[]>;
    /**
     * Keeps this choice in place of the use's, while its provider is
     * connected: false, and nothing kept, when it is not (removed
     * meanwhile included).
     */
    readonly set: (
      workspaceId: WorkspaceId,
      settings: CapabilityModelSettings
    ) => Effect.Effect<boolean>;
    readonly unset: (
      workspaceId: WorkspaceId,
      capability: AiCapability
    ) => Effect.Effect<void>;
  }
>()("peal-server/assistant/application/CapabilityModels") {}
