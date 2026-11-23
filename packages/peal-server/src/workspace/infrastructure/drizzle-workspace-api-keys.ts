import { and, asc, eq, inArray } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";

import { DatabaseError } from "#shared/application/database-error.ts";
import { permissionsOf } from "#shared/domain/access.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";
import { WorkspaceApiKeys } from "#workspace/application/workspace-api-keys.ts";
import { ApiKey } from "#workspace/domain/api-key.ts";

import { apikey } from "./auth-schema.generated.ts";

/**
 * What Peal writes in a key's metadata, which Better Auth's API key plugin
 * keeps as JSON: the member who made it. Better Auth's own key routes are
 * disabled, so nothing else writes it.
 */
export const makerMetadata = (createdBy: UserId) => ({ createdBy });

const decodeMaker = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ createdBy: UserIdSchema }))
);

/** The member a key's stored metadata names; none for a key made before. */
export const makerOf = (metadata: string | null): Option.Option<UserId> =>
  decodeMaker(metadata).pipe(Option.map(({ createdBy }) => createdBy));

// Better Auth stores a key's permissions as a JSON grant.
const decodeGrant = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Record(Schema.String, Schema.Array(Schema.String))
  )
);

const isUuid = Schema.is(Schema.String.check(Schema.isUUID()));

const utc = (date: Date): DateTime.Utc => DateTime.makeUnsafe(date);

/** A key as Better Auth's table holds it, for the workspace it names. */
export const apiKeyOf = (
  row: typeof apikey.$inferSelect,
  workspaceId: WorkspaceId
): ApiKey =>
  new ApiKey({
    createdAt: utc(row.createdAt),
    createdBy: makerOf(row.metadata),
    expiresAt: Option.fromNullishOr(row.expiresAt).pipe(Option.map(utc)),
    id: row.id,
    name: row.name ?? "",
    permissions: decodeGrant(row.permissions).pipe(
      Option.match({ onNone: () => [], onSome: permissionsOf })
    ),
    start: Option.fromNullishOr(row.start),
    workspaceId,
  });

const failed = (cause: unknown) => new DatabaseError({ cause });

/**
 * Better Auth's `apikey` table, through the server's own Drizzle driver,
 * so a revocation joins the caller's transaction.
 */
export const DrizzleWorkspaceApiKeys = Layer.effect(
  WorkspaceApiKeys,
  Effect.gen(function* drizzleWorkspaceApiKeys() {
    const db = yield* Drizzle;

    return WorkspaceApiKeys.of({
      list: (workspaceId) =>
        db
          .select()
          .from(apikey)
          .where(eq(apikey.referenceId, workspaceId))
          .orderBy(asc(apikey.createdAt), asc(apikey.id))
          .pipe(
            Effect.map((rows) => rows.map((row) => apiKeyOf(row, workspaceId))),
            Effect.mapError(failed),
            Effect.withSpan("WorkspaceApiKeys.list")
          ),
      // Ids are UUIDs: anything else names no key, and would not reach the
      // database's uuid column.
      revoke: (workspaceId, apiKeyIds) => {
        const ids = apiKeyIds.filter(isUuid);

        return ids.length === 0
          ? Effect.succeed([])
          : db
              .delete(apikey)
              .where(
                and(
                  eq(apikey.referenceId, workspaceId),
                  inArray(apikey.id, ids)
                )
              )
              .returning({ id: apikey.id })
              .pipe(
                Effect.map((rows) => rows.map(({ id }) => id)),
                Effect.mapError(failed),
                Effect.withSpan("WorkspaceApiKeys.revoke")
              );
      },
    });
  })
);
