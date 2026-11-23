import { Effect, Layer, Option, Schema } from "effect";

import { ProviderSecrets } from "#assistant/application/ports/provider-secrets.ts";
import type {
  ProviderUse,
  SealedProviderKey,
} from "#assistant/application/ports/provider-secrets.ts";
import { ProviderSecretsNotConfigured } from "#assistant/application/provider-secrets-not-configured.ts";
import {
  EncryptedTokenSchema,
  imageProviderContext,
  providerConnectionContext,
  textProviderContext,
  TokenCipher,
  tokenKeyIdOf,
} from "#channels/application/token-cipher.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

const isEncryptedToken = Schema.is(EncryptedTokenSchema);

// Each use has a context of its own.
const contextOf = (
  workspaceId: WorkspaceId,
  address: string,
  use: ProviderUse
) => {
  if (use === "images") {
    return imageProviderContext(workspaceId, address);
  }

  return use === "text"
    ? textProviderContext(workspaceId, address)
    : providerConnectionContext(workspaceId, use.connection, address);
};

/**
 * Workspaces' provider keys on the channels context's token cipher:
 * encrypted with the server's keyring (`PEAL_TOKEN_KEYS`), bound to
 * `assistant:provider:<workspace id>:<provider>:<address>` for a
 * connected provider, and, for the keys the release before kept,
 * `assistant:<workspace id>:<address>` for images and
 * `assistant:text:<workspace id>:<address>` for text. Peal keeps one cipher, so a
 * rotation reaches these keys too: nothing here encrypts on its own. A
 * key that does not decrypt opens as none, and is never logged.
 */
export const CipherProviderSecrets = Layer.effect(
  ProviderSecrets,
  Effect.gen(function* CipherProviderSecrets() {
    const cipher = yield* TokenCipher;

    return ProviderSecrets.of({
      open: (sealed, workspaceId, address, use) =>
        isEncryptedToken(sealed)
          ? cipher
              .decryptSecret(sealed, contextOf(workspaceId, address, use))
              .pipe(
                Effect.map(Option.some),
                Effect.catch(() => Effect.succeedNone)
              )
          : Effect.succeedNone,
      seal: (key, workspaceId, address, use) =>
        cipher.encryptSecret(key, contextOf(workspaceId, address, use)).pipe(
          Effect.map((sealed): SealedProviderKey => ({
            keyId: tokenKeyIdOf(sealed),
            sealed,
          })),
          Effect.mapError(() => new ProviderSecretsNotConfigured())
        ),
    });
  })
);
