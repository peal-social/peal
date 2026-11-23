import { DateTime, Effect } from "effect";

import { CapabilityNotOffered } from "#assistant/application/capability-not-offered.ts";
import { ModelRequired } from "#assistant/application/model-required.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ImageModel } from "#assistant/application/ports/image-model.ts";
import { WritingModel } from "#assistant/application/ports/writing-model.ts";
import { ProviderNotConnected } from "#assistant/application/provider-not-connected.ts";
import {
  aiCapabilities,
  offersCapability,
} from "#assistant/domain/ai-capability.ts";
import type {
  AiCapability,
  ConnectedProviderId,
} from "#assistant/domain/ai-capability.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import { compositionModel } from "#assistant/domain/composition-provider.ts";
import { checkProviderModel } from "#assistant/domain/image-provider.ts";
import type { ProviderModel } from "#assistant/domain/image-provider.ts";
import type { Actor } from "#shared/domain/access.ts";

/**
 * What the workspace uses for one use: its provider and model, or none,
 * and whether the server has a model of its own that works meanwhile.
 */
export interface CapabilityModelView {
  readonly capability: AiCapability;
  readonly model: ProviderModel | null;
  readonly provider: ConnectedProviderId | null;
  readonly serverModel: boolean;
  readonly updatedAt: DateTime.Utc | null;
}

/**
 * What a member chooses for a use: a connected provider and a model, which
 * `composition` takes none of.
 */
export interface CapabilityModelChange {
  readonly model?: string;
  readonly provider: ConnectedProviderId;
}

// Whether the server's operator set up a model for each use.
const serverModels = Effect.gen(function* serverModels() {
  const writing = yield* WritingModel;
  const images = yield* ImageModel;

  const server: Readonly<Record<AiCapability, boolean>> = {
    image: yield* images.available,
    text: writing.available,
    // Only a workspace's own provider makes videos, voice-overs,
    // transcripts and slide videos.
    composition: false,
    speech: false,
    transcription: false,
    video: false,
  };

  return server;
});

/** Every use of the actor's workspace, chosen or not, in the contract's order. */
export const listModels = Effect.fn("ModelSettings.list")(function* listModels(
  actor: Actor
) {
  const chosen = yield* CapabilityModels.use((models) =>
    models.list(actor.workspaceId)
  );

  const server = yield* serverModels;

  return aiCapabilities.map((capability): CapabilityModelView => {
    const mine = chosen.find((each) => each.capability === capability);

    return {
      capability,
      model: mine?.model ?? null,
      provider: mine?.provider ?? null,
      serverModel: server[capability],
      updatedAt: mine?.updatedAt ?? null,
    };
  });
});

/**
 * Chooses a provider and a model for one use: a provider the catalogue
 * says offers it (CapabilityNotOffered otherwise) and the workspace
 * connected (ProviderNotConnected otherwise, removed meanwhile included),
 * and a model but for `composition` (ModelRequired otherwise). The model
 * is one line; it is not checked with the provider.
 */
export const setModel = Effect.fn("ModelSettings.set")(function* setModel(
  actor: Actor,
  capability: AiCapability,
  change: CapabilityModelChange
) {
  if (!offersCapability(change.provider, capability)) {
    return yield* new CapabilityNotOffered();
  }

  // A composition takes no model: it is stored as the API it renders with.
  const named = capability === "composition" ? compositionModel : change.model;

  if (named === undefined) {
    return yield* new ModelRequired();
  }

  const settings = new CapabilityModelSettings({
    capability,
    model: yield* Effect.fromResult(checkProviderModel(named)),
    provider: change.provider,
    updatedAt: yield* DateTime.now,
  });

  const kept = yield* CapabilityModels.use((models) =>
    models.set(actor.workspaceId, settings)
  );

  if (!kept) {
    return yield* new ProviderNotConnected();
  }

  const server = yield* serverModels;

  const view: CapabilityModelView = {
    capability,
    model: settings.model,
    provider: settings.provider,
    serverModel: server[capability],
    updatedAt: settings.updatedAt,
  };

  return view;
});

/**
 * Leaves a use to the server's model, if it has one, or off; its
 * provider stays connected.
 */
export const unsetModel = Effect.fn("ModelSettings.unset")(function* unsetModel(
  actor: Actor,
  capability: AiCapability
) {
  yield* CapabilityModels.use((models) =>
    models.unset(actor.workspaceId, capability)
  );
});
