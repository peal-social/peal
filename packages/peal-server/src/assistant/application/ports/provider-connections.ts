import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { ProviderSecretsNotConfigured } from "#assistant/application/provider-secrets-not-configured.ts";
import type { ConnectedProviderId } from "#assistant/domain/ai-capability.ts";
import type { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/** A connected provider as the settings page reads it: never its key. */
export interface StoredConnection {
  /**
   * The stored key no longer decrypts (its key left the keyring, or the
   * row moved): nothing is sent with it until the key is typed again.
   */
  readonly keyUnreadable: boolean;
  readonly settings: ProviderConnectionSettings;
}

/**
 * A connected provider ready for a call: its settings and its key, none
 * when the stored key no longer decrypts.
 */
export interface OpenedConnection {
  readonly apiKey: Option.Option<Redacted.Redacted>;
  readonly settings: ProviderConnectionSettings;
}

/**
 * The providers each workspace connected, one row a provider, each key
 * sealed for that workspace, provider and address. Every write here also
 * deletes the workspace's rows of the text and image provider tables the
 * release before kept, so a roll-back never brings back a key the
 * workspace replaced or removed. A database failure is a defect.
 */
export class ProviderConnections extends Context.Service<
  ProviderConnections,
  {
    /** The workspace's connections, without their keys, in no order. */
    readonly list: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<readonly StoredConnection[]>;
    /** One connection with its key, for a call; none when not connected. */
    readonly open: (
      workspaceId: WorkspaceId,
      provider: ConnectedProviderId
    ) => Effect.Effect<Option.Option<OpenedConnection>>;
    /**
     * Keeps these settings and this key, sealed, in place of the
     * provider's; the uses it serves stay.
     */
    readonly save: (
      workspaceId: WorkspaceId,
      settings: ProviderConnectionSettings,
      key: Redacted.Redacted
    ) => Effect.Effect<void, ProviderSecretsNotConfigured>;
    /** Removes the connection, its key and the uses it served. */
    readonly remove: (
      workspaceId: WorkspaceId,
      provider: ConnectedProviderId
    ) => Effect.Effect<void>;
  }
>()("peal-server/assistant/application/ProviderConnections") {}
