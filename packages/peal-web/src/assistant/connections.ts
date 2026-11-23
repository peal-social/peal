import { Match } from "effect";
import type {
  AiCapabilityModel,
  AiCapabilityNotOffered,
  AiModelRequired,
  AiProviderAddressRefused,
  AiProviderConnection,
  AiProviderConnectionChange,
  AiProviderKeyRequired,
  AiProviderNotConnected,
  AssistantFailed,
  AssistantSecretsNotConfigured,
  Forbidden,
  OwnTextLimitReached,
  TextProviderBusy,
  TextProviderRefused,
  TooManyRequests,
  Unauthenticated,
  WorkspaceNotFound,
} from "peal-contract";
import { aiProviders } from "peal-contract/ai-providers";
import type { AiProviderId } from "peal-contract/ai-providers";

import {
  defaultAddressOf,
  isAnotherProvider,
  modelsFor,
} from "#assistant/provider-catalogue.ts";

/** What the provider's form holds: which provider, its address, a key typed or not. */
export interface ConnectionDraft {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly provider: AiProviderId;
}

/**
 * The form for a connection the workspace has, or for a new one of this
 * provider, at its own address.
 */
export const draftOf = (
  saved: AiProviderConnection | null,
  provider: AiProviderId
): ConnectionDraft => ({
  apiKey: "",
  baseUrl: saved?.baseUrl ?? defaultAddressOf(provider) ?? "",
  provider: saved?.provider ?? provider,
});

/** The form once the member picks another provider: its own address. */
export const providerChosen = (
  draft: ConnectionDraft,
  provider: AiProviderId
): ConnectionDraft => ({
  ...draft,
  baseUrl: defaultAddressOf(provider) ?? "",
  provider,
});

// The address as the server keeps it: written by URL, without the slashes
// that end it; none for what is not an address yet.
const addressOf = (text: string): string | null =>
  URL.parse(text.trim())?.href.replace(/\/+$/u, "") ?? null;

/** Whether an address is the provider's own, which a row then leaves unsaid. */
export const isOwnAddress = (
  provider: AiProviderId,
  address: string
): boolean => {
  const own = defaultAddressOf(provider);

  return own !== null && addressOf(own) === addressOf(address);
};

/**
 * Why the key must be typed now, or null when the saved one is kept: none
 * is saved, the saved one can no longer be read, or the address changed
 * (its host or its path), where Peal never sends a key given for the
 * first.
 */
export const keyNeeded = (
  draft: ConnectionDraft,
  saved: AiProviderConnection | null
): "keyAgain" | "keyUnreadable" | "noKey" | null => {
  if (saved === null) {
    return "noKey";
  }

  if (saved.keyUnreadable) {
    return "keyUnreadable";
  }

  return addressOf(draft.baseUrl) === addressOf(saved.baseUrl)
    ? null
    : "keyAgain";
};

/**
 * The request a save sends: the address only when it is not the
 * provider's own (so the server keeps following the catalogue's), the
 * key only when it was typed.
 */
export const changeOf = (
  draft: ConnectionDraft
): AiProviderConnectionChange => {
  const baseUrl = draft.baseUrl.trim();
  const address = isOwnAddress(draft.provider, baseUrl) ? {} : { baseUrl };
  // A pasted key comes with spaces, which no key holds.
  const apiKey = draft.apiKey.trim();

  return apiKey === "" ? address : { ...address, apiKey };
};

/** Whether the form can be saved: an address, and a key if needed. */
export const isSavable = (
  draft: ConnectionDraft,
  saved: AiProviderConnection | null
): boolean =>
  draft.baseUrl.trim() !== "" &&
  (draft.apiKey.trim() !== "" || keyNeeded(draft, saved) === null);

/**
 * The model a test of the provider asks: the text's when this provider
 * writes it, else the first the catalogue suggests; null for another
 * provider that writes nothing yet, which the form then does not offer
 * to test.
 */
export const testModelOf = (
  provider: AiProviderId,
  models: readonly AiCapabilityModel[]
): string | null => {
  const text = models.find(
    ({ capability, provider: chosen }) =>
      capability === "text" && chosen === provider
  );

  return text?.model ?? modelsFor(provider, "text")[0] ?? null;
};

/** Whether the provider is one the member names by its address alone. */
export const typesItsAddress = (provider: AiProviderId): boolean =>
  isAnotherProvider(provider);

/**
 * Whether the provider is reached at its own address alone (ElevenLabs,
 * fal, Shotstack): its form shows no address field.
 */
export const hasFixedAddress = (provider: AiProviderId): boolean =>
  aiProviders[provider].fixedAddress;

/**
 * The sandbox a service offers beside its production address (Shotstack's
 * `stage`, free and always watermarked), which its form offers under
 * **Advanced**; null for every other provider.
 */
export const sandboxAddressOf = (provider: AiProviderId): string | null =>
  aiProviders[provider].composition?.sandboxUrl ?? null;

/** Whether an address is the provider's sandbox. */
export const isSandboxAddress = (
  provider: AiProviderId,
  address: string
): boolean => {
  const sandbox = sandboxAddressOf(provider);

  return sandbox !== null && addressOf(sandbox) === addressOf(address);
};

/**
 * The form once the member picks the sandbox or production: the sandbox's
 * address, or the provider's own.
 */
export const sandboxChosen = (
  draft: ConnectionDraft,
  sandbox: boolean
): ConnectionDraft => ({
  ...draft,
  baseUrl:
    (sandbox
      ? sandboxAddressOf(draft.provider)
      : defaultAddressOf(draft.provider)) ?? draft.baseUrl,
});

/** Why a save failed, as the API declares it. */
export type ConnectionFailure =
  | AiProviderAddressRefused
  | AiProviderKeyRequired
  | AssistantSecretsNotConfigured
  | Forbidden
  | TooManyRequests
  | Unauthenticated
  | WorkspaceNotFound
  | { readonly _tag: "Unexpected" };

/** The message of `Assistant.connections.errors` that says why. */
export type ConnectionErrorKey =
  | AiProviderAddressRefused["reason"]
  | "forbidden"
  | "generic"
  | "keyRequired"
  | "notConfigured";

export const connectionErrorKey = (
  failure: ConnectionFailure
): ConnectionErrorKey =>
  Match.valueTags(failure, {
    AiProviderAddressRefused: ({ reason }): ConnectionErrorKey => reason,
    AiProviderKeyRequired: (): ConnectionErrorKey => "keyRequired",
    AssistantSecretsNotConfigured: (): ConnectionErrorKey => "notConfigured",
    Forbidden: (): ConnectionErrorKey => "forbidden",
    TooManyRequests: (): ConnectionErrorKey => "generic",
    Unauthenticated: (): ConnectionErrorKey => "generic",
    Unexpected: (): ConnectionErrorKey => "generic",
    WorkspaceNotFound: (): ConnectionErrorKey => "generic",
  });

/** Why the test failed, as the API declares it. */
export type ConnectionTestFailure =
  | AiCapabilityNotOffered
  | AiModelRequired
  | AiProviderNotConnected
  | AssistantFailed
  | Forbidden
  | OwnTextLimitReached
  | TextProviderBusy
  | TextProviderRefused
  | TooManyRequests
  | Unauthenticated
  | WorkspaceNotFound
  | { readonly _tag: "Unexpected" };

// The provider's own refusals: its settings are to fix.
const refusalKeys = {
  addressRefused: "providerAddress",
  keyUnreadable: "providerKey",
  redirected: "providerRedirected",
  settingsRefused: "providerRefused",
} as const;

/** The message of `Assistant.connections.testErrors` that says why. */
export type ConnectionTestKey =
  | AssistantFailed["reason"]
  | (typeof refusalKeys)[keyof typeof refusalKeys]
  | "forbidden"
  | "generic"
  | "modelRequired"
  | "ownBusy"
  | "ownLimit";

export const testFailureKey = (
  failure: ConnectionTestFailure
): ConnectionTestKey =>
  Match.valueTags(failure, {
    // Offered only for a provider that writes, and one connected: another
    // tab changed it meanwhile.
    AiCapabilityNotOffered: (): ConnectionTestKey => "generic",
    AiModelRequired: (): ConnectionTestKey => "modelRequired",
    AiProviderNotConnected: (): ConnectionTestKey => "generic",
    AssistantFailed: ({ reason }): ConnectionTestKey => reason,
    Forbidden: (): ConnectionTestKey => "forbidden",
    OwnTextLimitReached: (): ConnectionTestKey => "ownLimit",
    TextProviderBusy: (): ConnectionTestKey => "ownBusy",
    TextProviderRefused: ({ reason }): ConnectionTestKey => refusalKeys[reason],
    TooManyRequests: (): ConnectionTestKey => "generic",
    Unauthenticated: (): ConnectionTestKey => "generic",
    Unexpected: (): ConnectionTestKey => "generic",
    WorkspaceNotFound: (): ConnectionTestKey => "generic",
  });
