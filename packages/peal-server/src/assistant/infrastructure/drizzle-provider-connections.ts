import { and, eq } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import type {
  OpenedConnection,
  StoredConnection,
} from "#assistant/application/ports/provider-connections.ts";
import { ProviderSecrets } from "#assistant/application/ports/provider-secrets.ts";
import {
  AiCapabilitySchema,
  ConnectedProviderIdSchema,
} from "#assistant/domain/ai-capability.ts";
import { CapabilityModelSettings } from "#assistant/domain/capability-model.ts";
import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "#assistant/domain/image-provider.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import {
  capabilityModels,
  imageProviders,
  providerConnections,
  textProviders,
} from "./schema.ts";

type ConnectionRow = typeof providerConnections.$inferSelect;

type ModelRow = typeof capabilityModels.$inferSelect;

const decodeProvider = Schema.decodeUnknownOption(ConnectedProviderIdSchema);

const decodeCapability = Schema.decodeUnknownOption(AiCapabilitySchema);

// A row naming a provider this release does not know (one a later release
// connected) is left out, as if it were not there.
const connectionOf = (row: ConnectionRow) =>
  decodeProvider(row.provider).pipe(
    Option.map(
      (provider) =>
        new ProviderConnectionSettings({
          baseUrl: ProviderAddressSchema.make(row.baseUrl),
          provider,
          updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
        })
    )
  );

// So is a use, or a provider, this release does not know.
const modelOf = (row: ModelRow) =>
  Option.all({
    capability: decodeCapability(row.capability),
    provider: decodeProvider(row.provider),
  }).pipe(
    Option.map(
      ({ capability, provider }) =>
        new CapabilityModelSettings({
          capability,
          model: ProviderModelSchema.make(row.model),
          provider,
          updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
        })
    )
  );

/**
 * Deletes the workspace's rows of the tables the release before kept for
 * its text and image providers: once a workspace changes its providers,
 * a roll-back finds none rather than a key it replaced or removed.
 */
const forgetEarlierRows = (workspaceId: WorkspaceId) =>
  Effect.gen(function* forgetting() {
    const db = yield* Drizzle;

    yield* db
      .delete(textProviders)
      .where(eq(textProviders.workspaceId, workspaceId));
    yield* db
      .delete(imageProviders)
      .where(eq(imageProviders.workspaceId, workspaceId));
  });

/**
 * ProviderConnections in Postgres (`assistant.provider_connections`), the
 * keys sealed through ProviderSecrets for the connection: bound to the
 * workspace, the provider and the address in the same row, so a row whose
 * address moved, or that was copied to another workspace or provider,
 * opens without its key. A database failure is a defect.
 */
export const DrizzleProviderConnectionsLive = Layer.effect(
  ProviderConnections,
  Effect.gen(function* DrizzleProviderConnections() {
    const db = yield* Drizzle;
    const client = yield* SqlClient.SqlClient;
    const secrets = yield* ProviderSecrets;

    const opened = (workspaceId: WorkspaceId, row: ConnectionRow) =>
      Effect.gen(function* opening() {
        const settings = connectionOf(row);

        if (Option.isNone(settings)) {
          return Option.none<OpenedConnection>();
        }

        const connection: OpenedConnection = {
          apiKey: yield* secrets.open(row.sealedKey, workspaceId, row.baseUrl, {
            connection: settings.value.provider,
          }),
          settings: settings.value,
        };

        return Option.some(connection);
      });

    return ProviderConnections.of({
      list: Effect.fn("ProviderConnections.list")(function* list(workspaceId) {
        const rows = yield* db
          .select()
          .from(providerConnections)
          .where(eq(providerConnections.workspaceId, workspaceId))
          .pipe(Effect.orDie);

        const each = yield* Effect.all(
          rows.map((row) => opened(workspaceId, row))
        );

        // What the settings page reads: whether the key opens, never the key.
        return each.flatMap((connection) =>
          Option.isSome(connection)
            ? [
                {
                  keyUnreadable: Option.isNone(connection.value.apiKey),
                  settings: connection.value.settings,
                } satisfies StoredConnection,
              ]
            : []
        );
      }),
      open: Effect.fn("ProviderConnections.open")(
        function* open(workspaceId, provider) {
          const [row] = yield* db
            .select()
            .from(providerConnections)
            .where(
              and(
                eq(providerConnections.workspaceId, workspaceId),
                eq(providerConnections.provider, provider)
              )
            )
            .pipe(Effect.orDie);

          return row === undefined
            ? Option.none<OpenedConnection>()
            : yield* opened(workspaceId, row);
        }
      ),
      remove: (workspaceId, provider) =>
        client
          .withTransaction(
            Effect.gen(function* remove() {
              // The uses it served go with it (the foreign key's cascade).
              yield* db
                .delete(providerConnections)
                .where(
                  and(
                    eq(providerConnections.workspaceId, workspaceId),
                    eq(providerConnections.provider, provider)
                  )
                );
              yield* forgetEarlierRows(workspaceId);
            })
          )
          .pipe(
            Effect.provideService(Drizzle, db),
            Effect.orDie,
            Effect.withSpan("ProviderConnections.remove")
          ),
      save: Effect.fn("ProviderConnections.save")(
        function* save(workspaceId, settings, key) {
          // Sealed first: without a keyring, nothing is stored.
          const { keyId, sealed } = yield* secrets.seal(
            key,
            workspaceId,
            settings.baseUrl,
            { connection: settings.provider }
          );

          const at = DateTime.toDateUtc(settings.updatedAt);

          const values = {
            baseUrl: settings.baseUrl,
            keyId,
            sealedKey: sealed,
            updatedAt: at,
          };

          yield* client
            .withTransaction(
              Effect.gen(function* saving() {
                yield* db
                  .insert(providerConnections)
                  .values({
                    ...values,
                    createdAt: at,
                    provider: settings.provider,
                    workspaceId,
                  })
                  .onConflictDoUpdate({
                    set: values,
                    target: [
                      providerConnections.workspaceId,
                      providerConnections.provider,
                    ],
                  });
                yield* forgetEarlierRows(workspaceId);
              })
            )
            .pipe(Effect.provideService(Drizzle, db), Effect.orDie);
        }
      ),
    });
  })
);

/** CapabilityModels in Postgres (`assistant.capability_models`). */
export const DrizzleCapabilityModelsLive = Layer.effect(
  CapabilityModels,
  Effect.gen(function* DrizzleCapabilityModels() {
    const db = yield* Drizzle;
    const client = yield* SqlClient.SqlClient;

    return CapabilityModels.of({
      list: (workspaceId) =>
        db
          .select()
          .from(capabilityModels)
          .where(eq(capabilityModels.workspaceId, workspaceId))
          .pipe(
            Effect.map((rows) =>
              rows.flatMap((row) => Option.toArray(modelOf(row)))
            ),
            Effect.orDie,
            Effect.withSpan("CapabilityModels.list")
          ),
      set: (workspaceId, settings) =>
        client
          .withTransaction(
            Effect.gen(function* setting() {
              // Only while the provider is connected: a removal that came
              // first leaves nothing to point at.
              const rows = yield* client<{ readonly capability: string }>`
                INSERT INTO assistant.capability_models
                  (workspace_id, capability, provider, model, updated_at)
                SELECT workspace_id, ${settings.capability}, provider,
                  ${settings.model}, ${DateTime.toDateUtc(settings.updatedAt)}
                FROM assistant.provider_connections
                WHERE workspace_id = ${workspaceId}
                  AND provider = ${settings.provider}
                ON CONFLICT (workspace_id, capability) DO UPDATE
                  SET provider = excluded.provider, model = excluded.model,
                    updated_at = excluded.updated_at
                RETURNING capability`;

              if (rows.length > 0) {
                yield* forgetEarlierRows(workspaceId);
              }

              return rows.length > 0;
            })
          )
          .pipe(
            Effect.provideService(Drizzle, db),
            Effect.orDie,
            Effect.withSpan("CapabilityModels.set")
          ),
      unset: (workspaceId, capability) =>
        client
          .withTransaction(
            Effect.gen(function* unsetting() {
              yield* db
                .delete(capabilityModels)
                .where(
                  and(
                    eq(capabilityModels.workspaceId, workspaceId),
                    eq(capabilityModels.capability, capability)
                  )
                );
              yield* forgetEarlierRows(workspaceId);
            })
          )
          .pipe(
            Effect.provideService(Drizzle, db),
            Effect.orDie,
            Effect.withSpan("CapabilityModels.unset")
          ),
    });
  })
);
