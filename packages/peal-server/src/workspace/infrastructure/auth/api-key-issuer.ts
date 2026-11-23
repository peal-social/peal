import { asc, eq } from "drizzle-orm";
import {
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";

import { grantOf } from "#shared/domain/access.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";
import { ApiKeyIssuer } from "#workspace/application/api-key-issuer.ts";
import { AuthUnavailable } from "#workspace/application/auth-unavailable.ts";
import { ApiKey } from "#workspace/domain/api-key.ts";
import { apikey } from "#workspace/infrastructure/auth-schema.generated.ts";
import {
  apiKeyOf,
  makerMetadata,
} from "#workspace/infrastructure/drizzle-workspace-api-keys.ts";

import { attempt } from "./attempt.ts";
import { BetterAuth } from "./better-auth.ts";

const isUuid = Schema.is(Schema.String.check(Schema.isUUID()));

const utc = (date: Date): DateTime.Utc => DateTime.makeUnsafe(date);

/**
 * API keys through Better Auth's API key plugin. Better Auth creates and
 * deletes them, as it hashes keys and counts their use, and keeps who made
 * each in its metadata (`makerMetadata`); listing reads its table with the
 * server's own Drizzle driver.
 */
export const ApiKeyIssuerLive = Layer.effect(
  ApiKeyIssuer,
  Effect.gen(function* apiKeyIssuer() {
    const auth = yield* BetterAuth;
    const db = yield* Drizzle;
    const { adapter } = yield* Effect.promise(async () => await auth.$context);

    return ApiKeyIssuer.of({
      // Without request headers, a server call may set permissions; Better
      // Auth still checks that the creating member's role allows
      // apiKey:create in the workspace.
      issue: (request) =>
        attempt(
          async () =>
            await auth.api.createApiKey({
              body: {
                expiresIn: Option.match(request.expiresIn, {
                  onNone: () => null,
                  onSome: Duration.toSeconds,
                }),
                metadata: makerMetadata(request.createdBy),
                name: request.name,
                organizationId: request.workspaceId,
                permissions: grantOf(request.permissions),
                userId: request.createdBy,
              },
            })
        ).pipe(
          Effect.map((created) => ({
            apiKey: new ApiKey({
              createdAt: utc(created.createdAt),
              createdBy: Option.some(request.createdBy),
              expiresAt: Option.fromNullishOr(created.expiresAt).pipe(
                Option.map(utc)
              ),
              id: created.id,
              name: request.name,
              permissions: request.permissions,
              start: Option.fromNullishOr(created.start),
              workspaceId: request.workspaceId,
            }),
            key: Redacted.make(created.key),
          })),
          Effect.withSpan("ApiKeyIssuer.issue")
        ),
      list: (workspaceId) =>
        db
          .select()
          .from(apikey)
          .where(eq(apikey.referenceId, workspaceId))
          .orderBy(asc(apikey.createdAt), asc(apikey.id))
          .pipe(
            Effect.map((rows) => rows.map((row) => apiKeyOf(row, workspaceId))),
            Effect.mapError((cause) => new AuthUnavailable({ cause })),
            Effect.withSpan("ApiKeyIssuer.list")
          ),
      // Ids are UUIDs: anything else names no key, and would not reach the
      // database's uuid column.
      revoke: (workspaceId, apiKeyId) =>
        isUuid(apiKeyId)
          ? attempt(
              async () =>
                await adapter.deleteMany({
                  model: "apikey",
                  where: [
                    { field: "id", value: apiKeyId },
                    { field: "referenceId", value: workspaceId },
                  ],
                })
            ).pipe(
              Effect.map((deleted) => deleted > 0),
              Effect.withSpan("ApiKeyIssuer.revoke")
            )
          : Effect.succeed(false),
    });
  })
);
