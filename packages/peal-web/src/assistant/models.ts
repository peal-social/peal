import { Match } from "effect";
import type {
  AiCapabilityNotOffered,
  AiModelRequired,
  AiProviderConnection,
  AiProviderNotConnected,
  Forbidden,
  TooManyRequests,
  Unauthenticated,
  WorkspaceNotFound,
} from "peal-contract";
import type { AiCapability, AiProviderId } from "peal-contract/ai-providers";

import {
  modelsFor,
  offers,
  providerOrder,
} from "#assistant/provider-catalogue.ts";

/**
 * The providers a use's select offers: those the workspace connected that
 * offer it, in the settings' order.
 */
export const providerChoicesFor = (
  capability: AiCapability,
  connections: readonly AiProviderConnection[]
): readonly AiProviderId[] =>
  providerOrder.filter(
    (provider) =>
      offers(provider, capability) &&
      connections.some((connection) => connection.provider === provider)
  );

/**
 * The model a use starts with once its provider is chosen: the one it
 * had there, else the first the catalogue suggests; null when the
 * catalogue suggests none, and the member types one.
 */
export const startingModelOf = (
  provider: AiProviderId,
  capability: AiCapability,
  before: {
    readonly model: string | null;
    readonly provider: AiProviderId | null;
  }
): string | null =>
  before.provider === provider && before.model !== null
    ? before.model
    : (modelsFor(provider, capability)[0] ?? null);

/** Whether the model is one the catalogue suggests, so its select shows it. */
export const isSuggested = (
  provider: AiProviderId,
  capability: AiCapability,
  model: string
): boolean => modelsFor(provider, capability).includes(model.trim());

/** Why a choice failed, as the API declares it. */
export type ModelFailure =
  | AiCapabilityNotOffered
  | AiModelRequired
  | AiProviderNotConnected
  | Forbidden
  | TooManyRequests
  | Unauthenticated
  | WorkspaceNotFound
  | { readonly _tag: "Unexpected" };

/** The message of `Assistant.models.errors` that says why. */
export type ModelErrorKey =
  | "forbidden"
  | "generic"
  | "notConnected"
  | "notOffered";

export const modelErrorKey = (failure: ModelFailure): ModelErrorKey =>
  Match.valueTags(failure, {
    AiCapabilityNotOffered: (): ModelErrorKey => "notOffered",
    // The row sends a model for every use that takes one.
    AiModelRequired: (): ModelErrorKey => "generic",
    AiProviderNotConnected: (): ModelErrorKey => "notConnected",
    Forbidden: (): ModelErrorKey => "forbidden",
    TooManyRequests: (): ModelErrorKey => "generic",
    Unauthenticated: (): ModelErrorKey => "generic",
    Unexpected: (): ModelErrorKey => "generic",
    WorkspaceNotFound: (): ModelErrorKey => "generic",
  });
