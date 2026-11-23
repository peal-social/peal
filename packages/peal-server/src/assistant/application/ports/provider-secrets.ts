import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { ProviderSecretsNotConfigured } from "#assistant/application/provider-secrets-not-configured.ts";
import type { ConnectedProviderId } from "#assistant/domain/ai-capability.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * What a workspace's key is bound to: the provider it connected
 * (`connection`), or, for the keys the release before kept, its images or
 * its text provider. A key sealed for one never opens for another.
 */
export type ProviderUse =
  | "images"
  | "text"
  | { readonly connection: ConnectedProviderId };

/**
 * A workspace's provider key as it is kept: encrypted
 * (`<keyId>.<iv>.<ciphertext>`), and the id of the key that encrypted
 * it, for a rotation.
 */
export interface SealedProviderKey {
  readonly keyId: string;
  readonly sealed: string;
}

/**
 * Seals the key a workspace gave for its own image or text provider, bound
 * to the workspace, to that use and to the provider's whole address, and
 * opens it
 * again for a call. The assistant keeps no crypto of its own: the adapter
 * uses the server's one cipher.
 */
export class ProviderSecrets extends Context.Service<
  ProviderSecrets,
  {
    readonly seal: (
      key: Redacted.Redacted,
      workspaceId: WorkspaceId,
      address: string,
      use: ProviderUse
    ) => Effect.Effect<SealedProviderKey, ProviderSecretsNotConfigured>;
    /**
     * The key, or none when it does not decrypt: its key left the
     * keyring, or the row was moved to another workspace, use or address.
     */
    readonly open: (
      sealed: string,
      workspaceId: WorkspaceId,
      address: string,
      use: ProviderUse
    ) => Effect.Effect<Option.Option<Redacted.Redacted>>;
  }
>()("peal-server/assistant/application/ProviderSecrets") {}
