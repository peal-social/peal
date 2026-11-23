import { assert, layer } from "@effect/vitest";
import {
  ConfigProvider,
  DateTime,
  Effect,
  Layer,
  Option,
  Redacted,
} from "effect";
import { SqlClient } from "effect/sql";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ImageProviders } from "#assistant/application/ports/image-providers.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { ProviderSecrets } from "#assistant/application/ports/provider-secrets.ts";
import { TextProviders } from "#assistant/application/ports/text-providers.ts";
import { ProviderStoresLive } from "#assistant/container.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import {
  ImageProviderSettings,
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import { TextProviderSettings } from "#assistant/domain/text-provider.ts";
import { CipherProviderSecrets } from "#assistant/infrastructure/cipher-provider-secrets.ts";
import { moveEarlierProviders } from "#assistant/infrastructure/move-earlier-providers.ts";
import type { TokenCipher } from "#channels/application/token-cipher.ts";
import { TokenCipherLive } from "#channels/infrastructure/web-crypto-token-cipher.ts";
import { Ids } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { DatabaseTest } from "#test/assistant/support.ts";
import { TokenCipherTest } from "#test/channels/support.ts";

// Workspaces' connected providers and their choice for each use on
// Postgres, their keys sealed with the synthetic keyring, the deprecated
// text and image provider views on them, and the start-up move of the
// release before's rows. Nothing here reaches a provider.

const syntheticKey = "synthetic-workspace-provider-key";

const otherKey = "synthetic-workspace-other-key";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const connection = (
  provider: "google" | "openai" | "openai-compatible",
  baseUrl: string
) =>
  new ProviderConnectionSettings({
    baseUrl: ProviderAddressSchema.make(baseUrl),
    provider,
    updatedAt: at,
  });

const choice = (
  capability: "image" | "text",
  provider: "google" | "openai" | "openai-compatible",
  model: string
) =>
  new CapabilityModelSettings({
    capability,
    model: ProviderModelSchema.make(model),
    provider,
    updatedAt: at,
  });

// A workspace no other test uses, whose rows go when the test ends.
const freshWorkspace = Effect.gen(function* freshWorkspace() {
  const workspaceId = WorkspaceIdSchema.make(yield* Ids.use((ids) => ids.next));
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.addFinalizer(() =>
    sql`DELETE FROM assistant.provider_connections WHERE workspace_id = ${workspaceId}`.pipe(
      Effect.andThen(
        sql`DELETE FROM assistant.text_providers WHERE workspace_id = ${workspaceId}`
      ),
      Effect.andThen(
        sql`DELETE FROM assistant.image_providers WHERE workspace_id = ${workspaceId}`
      ),
      Effect.ignore
    )
  );

  return workspaceId;
});

const storesOn = <E>(cipher: Layer.Layer<TokenCipher, E>) =>
  ProviderStoresLive.pipe(
    Layer.provideMerge(CipherProviderSecrets.pipe(Layer.provide(cipher))),
    Layer.provideMerge(DatabaseTest)
  );

const keyOf = (
  opened: Option.Option<{ readonly apiKey: Option.Option<Redacted.Redacted> }>
) =>
  opened.pipe(
    Option.flatMap(({ apiKey }) => apiKey),
    Option.map(Redacted.value)
  );

// A row of the release before, its key sealed as that release sealed it.
const earlierText = (
  workspaceId: typeof WorkspaceIdSchema.Type,
  row: {
    readonly baseUrl: string;
    readonly key: string;
    readonly kind: string;
    readonly model: string;
    readonly provider: string | null;
  }
) =>
  Effect.gen(function* sealingText() {
    const sql = yield* SqlClient.SqlClient;
    const secrets = yield* ProviderSecrets;

    const { keyId, sealed } = yield* secrets.seal(
      Redacted.make(row.key),
      workspaceId,
      row.baseUrl,
      "text"
    );

    yield* sql`INSERT INTO assistant.text_providers (workspace_id, kind, provider, base_url, model, sealed_key, key_id, updated_at)
      VALUES (${workspaceId}, ${row.kind}, ${row.provider}, ${row.baseUrl}, ${row.model}, ${sealed}, ${keyId}, ${DateTime.toDateUtc(at)})`;
  });

const earlierImage = (
  workspaceId: typeof WorkspaceIdSchema.Type,
  row: {
    readonly baseUrl: string;
    readonly key: string;
    readonly model: string;
    readonly provider: string | null;
  }
) =>
  Effect.gen(function* sealingImage() {
    const sql = yield* SqlClient.SqlClient;
    const secrets = yield* ProviderSecrets;

    const { keyId, sealed } = yield* secrets.seal(
      Redacted.make(row.key),
      workspaceId,
      row.baseUrl,
      "images"
    );

    yield* sql`INSERT INTO assistant.image_providers (workspace_id, provider, base_url, model, sealed_key, key_id, updated_at)
      VALUES (${workspaceId}, ${row.provider}, ${row.baseUrl}, ${row.model}, ${sealed}, ${keyId}, ${DateTime.toDateUtc(at)})`;
  });

layer(storesOn(TokenCipherTest), { timeout: "60 seconds" })(
  "workspaces' connected providers on Postgres",
  (it) => {
    it.effect(
      "gives the key back once saved, and never stores it as typed",
      () =>
        Effect.gen(function* saved() {
          const workspaceId = yield* freshWorkspace;
          const connections = yield* ProviderConnections;
          const sql = yield* SqlClient.SqlClient;
          const openai = connection("openai", "https://api.openai.com/v1");

          assert.deepStrictEqual(yield* connections.list(workspaceId), []);

          yield* connections.save(
            workspaceId,
            openai,
            Redacted.make(syntheticKey)
          );

          const opened = yield* connections.open(workspaceId, "openai");

          assert.deepStrictEqual(keyOf(opened), Option.some(syntheticKey));
          assert.deepStrictEqual(yield* connections.list(workspaceId), [
            { keyUnreadable: false, settings: openai },
          ]);

          const [row] = yield* sql<{
            readonly keyId: string;
            readonly sealedKey: string;
          }>`SELECT key_id AS "keyId", sealed_key AS "sealedKey" FROM assistant.provider_connections WHERE workspace_id = ${workspaceId}`;

          assert.notInclude(row?.sealedKey ?? "", syntheticKey);
          assert.strictEqual(row?.keyId, "test-key");
        })
    );

    it.effect(
      "opens no key whose row moved to another address, workspace or provider",
      () =>
        Effect.gen(function* moved() {
          const workspaceId = yield* freshWorkspace;
          const other = yield* freshWorkspace;
          const connections = yield* ProviderConnections;
          const sql = yield* SqlClient.SqlClient;

          yield* connections.save(
            workspaceId,
            connection("openai-compatible", "https://text.example.com/v1"),
            Redacted.make(syntheticKey)
          );

          yield* sql`INSERT INTO assistant.provider_connections (workspace_id, provider, base_url, sealed_key, key_id, created_at, updated_at)
            SELECT ${other}, provider, base_url, sealed_key, key_id, created_at, updated_at
            FROM assistant.provider_connections WHERE workspace_id = ${workspaceId}`;
          yield* sql`INSERT INTO assistant.provider_connections (workspace_id, provider, base_url, sealed_key, key_id, created_at, updated_at)
            SELECT workspace_id, 'openai', base_url, sealed_key, key_id, created_at, updated_at
            FROM assistant.provider_connections WHERE workspace_id = ${workspaceId}`;

          assert.isTrue(
            Option.isNone(
              keyOf(yield* connections.open(other, "openai-compatible"))
            )
          );
          assert.isTrue(
            Option.isNone(keyOf(yield* connections.open(workspaceId, "openai")))
          );

          yield* sql`UPDATE assistant.provider_connections SET base_url = 'https://text.example.com/other-account/v1' WHERE workspace_id = ${workspaceId} AND provider = 'openai-compatible'`;

          const listed = yield* connections.list(workspaceId);

          assert.isTrue(listed.every(({ keyUnreadable }) => keyUnreadable));
        })
    );

    it.effect(
      "keeps a choice only on a connected provider, and removes it with its connection",
      () =>
        Effect.gen(function* chosen() {
          const workspaceId = yield* freshWorkspace;
          const connections = yield* ProviderConnections;
          const models = yield* CapabilityModels;

          assert.isFalse(
            yield* models.set(
              workspaceId,
              choice("text", "openai", "gpt-6.2-sol")
            )
          );

          yield* connections.save(
            workspaceId,
            connection("openai", "https://api.openai.com/v1"),
            Redacted.make(syntheticKey)
          );

          assert.isTrue(
            yield* models.set(
              workspaceId,
              choice("text", "openai", "gpt-6.2-sol")
            )
          );
          assert.isTrue(
            yield* models.set(
              workspaceId,
              choice("image", "openai", "gpt-image-2.6-flare")
            )
          );
          assert.strictEqual((yield* models.list(workspaceId)).length, 2);

          yield* models.unset(workspaceId, "image");

          assert.deepStrictEqual(yield* models.list(workspaceId), [
            choice("text", "openai", "gpt-6.2-sol"),
          ]);

          yield* connections.remove(workspaceId, "openai");

          assert.deepStrictEqual(yield* models.list(workspaceId), []);
          assert.deepStrictEqual(yield* connections.list(workspaceId), []);
        })
    );

    it.effect("leaves out a provider or a use this release does not know", () =>
      Effect.gen(function* unknown() {
        const workspaceId = yield* freshWorkspace;
        const connections = yield* ProviderConnections;
        const models = yield* CapabilityModels;
        const sql = yield* SqlClient.SqlClient;

        yield* connections.save(
          workspaceId,
          connection("openai", "https://api.openai.com/v1"),
          Redacted.make(syntheticKey)
        );
        yield* sql`INSERT INTO assistant.provider_connections (workspace_id, provider, base_url, sealed_key, key_id, created_at, updated_at)
          VALUES (${workspaceId}, 'later-provider', 'https://later.example.com/v1', 'test-key.synthetic', 'test-key', now(), now())`;
        yield* sql`INSERT INTO assistant.capability_models (workspace_id, capability, provider, model, updated_at)
          VALUES (${workspaceId}, 'later-use', 'openai', 'synthetic-later-model', now()),
            (${workspaceId}, 'text', 'later-provider', 'synthetic-text-model', now())`;

        assert.deepStrictEqual(
          (yield* connections.list(workspaceId)).map(
            ({ settings }) => settings.provider
          ),
          ["openai"]
        );
        assert.deepStrictEqual(yield* models.list(workspaceId), []);
      })
    );

    it.effect(
      "reads the text and image providers on the connections, and deletes the release before's rows on any change",
      () =>
        Effect.gen(function* views() {
          const workspaceId = yield* freshWorkspace;
          const text = yield* TextProviders;
          const images = yield* ImageProviders;
          const connections = yield* ProviderConnections;
          const sql = yield* SqlClient.SqlClient;

          yield* earlierText(workspaceId, {
            baseUrl: "https://text.example.com/v1",
            key: otherKey,
            kind: "openai-compatible",
            model: "synthetic-text-model",
            provider: null,
          });

          // Gemini's text is at `/openai` past the provider's address.
          yield* text.save(
            workspaceId,
            new TextProviderSettings({
              baseUrl: ProviderAddressSchema.make(
                "https://generativelanguage.googleapis.com/v1beta/openai"
              ),
              kind: "openai-compatible",
              model: ProviderModelSchema.make("gemini-4-neon"),
              provider: "google",
              updatedAt: at,
            }),
            Redacted.make(syntheticKey)
          );

          const [earlier] = yield* sql<{
            readonly count: number;
          }>`SELECT count(*)::int AS count FROM assistant.text_providers WHERE workspace_id = ${workspaceId}`;

          assert.strictEqual(earlier?.count, 0);
          assert.deepStrictEqual(
            (yield* connections.list(workspaceId)).map(
              ({ settings }) => settings.baseUrl
            ),
            ["https://generativelanguage.googleapis.com/v1beta"]
          );

          yield* images.save(
            workspaceId,
            new ImageProviderSettings({
              baseUrl: ProviderAddressSchema.make(
                "https://generativelanguage.googleapis.com/v1beta"
              ),
              model: ProviderModelSchema.make("gemini-nano-banana-2.1"),
              provider: "google",
              updatedAt: at,
            }),
            Redacted.make(syntheticKey)
          );

          const openedText = yield* text.open(workspaceId);

          assert.deepStrictEqual(
            openedText.pipe(Option.map(({ settings }) => settings.baseUrl)),
            Option.some(
              "https://generativelanguage.googleapis.com/v1beta/openai"
            )
          );
          assert.deepStrictEqual(keyOf(openedText), Option.some(syntheticKey));

          // Removing the text keeps the connection the images are on.
          yield* text.remove(workspaceId);

          assert.isTrue(Option.isNone(yield* text.find(workspaceId)));
          assert.isTrue(Option.isSome(yield* images.find(workspaceId)));

          yield* images.remove(workspaceId);

          assert.deepStrictEqual(yield* connections.list(workspaceId), []);
        })
    );

    it.effect(
      "moves the release before's rows once: keys sealed again, Gemini's address its provider's, text first",
      () =>
        Effect.gen(function* move() {
          const workspaceId = yield* freshWorkspace;
          const compatible = yield* freshWorkspace;
          const connections = yield* ProviderConnections;
          const models = yield* CapabilityModels;
          const text = yield* TextProviders;
          const images = yield* ImageProviders;

          yield* earlierText(workspaceId, {
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
            key: syntheticKey,
            kind: "openai-compatible",
            model: "gemini-4-neon",
            provider: "google",
          });
          yield* earlierImage(workspaceId, {
            baseUrl: "https://generativelanguage.googleapis.com/v1beta",
            key: otherKey,
            model: "gemini-nano-banana-2.1",
            provider: "google",
          });

          // Another endpoint for each: the images stay where they were.
          yield* earlierText(compatible, {
            baseUrl: "https://text.example.com/v1",
            key: syntheticKey,
            kind: "openai-compatible",
            model: "synthetic-text-model",
            provider: null,
          });
          yield* earlierImage(compatible, {
            baseUrl: "https://images.example.com/v1",
            key: otherKey,
            model: "synthetic-image-model",
            provider: null,
          });

          yield* moveEarlierProviders();
          // A second start moves nothing more.
          yield* moveEarlierProviders();

          const opened = yield* connections.open(workspaceId, "google");

          assert.deepStrictEqual(
            opened.pipe(Option.map(({ settings }) => settings.baseUrl)),
            Option.some("https://generativelanguage.googleapis.com/v1beta")
          );
          // The text's key, sealed for the connection.
          assert.deepStrictEqual(keyOf(opened), Option.some(syntheticKey));
          assert.deepStrictEqual(
            (yield* models.list(workspaceId))
              .map(({ capability, model }) => `${capability}:${model}`)
              .toSorted(),
            ["image:gemini-nano-banana-2.1", "text:gemini-4-neon"]
          );
          assert.isTrue(Option.isSome(yield* text.find(workspaceId)));
          assert.isTrue(Option.isSome(yield* images.find(workspaceId)));

          assert.deepStrictEqual(
            (yield* models.list(compatible)).map(
              ({ capability }) => capability
            ),
            ["text"]
          );
        })
    );
  }
);

// A server whose operator set no keyring keeps no key.
const NoKeyring = TokenCipherLive.pipe(
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ PEAL_TOKEN_KEYS: "" }))
  )
);

layer(storesOn(NoKeyring), { timeout: "60 seconds" })(
  "workspaces' connected providers on a server without a keyring",
  (it) => {
    it.effect("refuses to save, and stores nothing", () =>
      Effect.gen(function* unconfigured() {
        const workspaceId = yield* freshWorkspace;
        const connections = yield* ProviderConnections;

        const refused = yield* connections
          .save(
            workspaceId,
            connection("openai", "https://api.openai.com/v1"),
            Redacted.make(syntheticKey)
          )
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "ProviderSecretsNotConfigured");
        assert.deepStrictEqual(yield* connections.list(workspaceId), []);
      })
    );
  }
);
