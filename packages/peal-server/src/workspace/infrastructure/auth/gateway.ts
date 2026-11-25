import { and, eq } from "drizzle-orm";
import { Effect, Layer, Option, Redacted, Schema } from "effect";

import { permissionsOf } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";
import { AuthGateway } from "#workspace/application/auth-gateway.ts";
import { AuthUnavailable } from "#workspace/application/auth-unavailable.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import { beyondMaker } from "#workspace/domain/api-key.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";
import {
  apikey,
  member,
  organization,
} from "#workspace/infrastructure/auth-schema.generated.ts";

import { credentialRefused, makeAccessTokens } from "./access-tokens.ts";
import { attempt } from "./attempt.ts";
import { BetterAuth } from "./better-auth.ts";
import { apiResourceOf, mcpResourceOf, workspaceClaim } from "./oauth.ts";
import { AuthSettings, trustedOriginsOf } from "./settings.ts";

// What Peal reads of Better Auth's answers. A session or key that does not
// match is treated as none.
const SessionSchema = Schema.Struct({
  session: Schema.Struct({
    impersonatedBy: Schema.optional(Schema.NullOr(UserIdSchema)),
  }),
  user: Schema.Struct({ id: UserIdSchema }),
});

const VerifiedKeySchema = Schema.Struct({
  key: Schema.Struct({
    id: Schema.NonEmptyString,
    permissions: Schema.NullOr(
      Schema.Record(Schema.String, Schema.Array(Schema.String))
    ),
    // What Peal wrote in it, which Better Auth answers parsed: the member
    // who made the key; nothing for a key made before makers were
    // recorded. Peal alone writes it (makerMetadata).
    metadata: Schema.optional(
      Schema.NullOr(Schema.Struct({ createdBy: Schema.optional(UserIdSchema) }))
    ),
    // Keys are owned by workspaces: the reference is the workspace's id.
    referenceId: WorkspaceIdSchema,
  }),
  valid: Schema.Literal(true),
});

// What Peal reads of an OAuth access token: the user (`sub`), the client
// (`azp`), the scopes the user agreed to, and the workspace a token issued
// after the workspace picker is bound to.
const tokenClaims = {
  azp: Schema.NonEmptyString,
  scope: Schema.optional(Schema.String),
  sub: UserIdSchema,
};

const ApiTokenClaimsSchema = Schema.Struct({
  ...tokenClaims,
  [workspaceClaim]: Schema.optional(WorkspaceIdSchema),
});

const McpTokenClaimsSchema = Schema.Struct({
  ...tokenClaims,
  [workspaceClaim]: WorkspaceIdSchema,
});

const principalOf = (claims: {
  readonly azp: string;
  readonly scope?: string | undefined;
  readonly sub: UserId;
  readonly workspace_id?: WorkspaceId | undefined;
}): UserPrincipal =>
  new UserPrincipal({
    impersonatedBy: Option.none(),
    oauth: Option.some({
      clientId: claims.azp,
      scopes: claims.scope?.split(" ") ?? [],
      workspaceId: Option.fromUndefinedOr(claims.workspace_id),
    }),
    userId: claims.sub,
  });

const decodeSession = Schema.decodeUnknownOption(SessionSchema);

// What the two-factor plugin's server-only call answers: the codes, which
// only their count leaves this file.
const decodeCodes = Schema.decodeUnknownOption(
  Schema.Struct({ backupCodes: Schema.Array(Schema.String) })
);

const isNotEnabled = Schema.is(
  Schema.Struct({
    body: Schema.Struct({ code: Schema.Literal("BACKUP_CODES_NOT_ENABLED") }),
  })
);

const decodeVerifiedKey = Schema.decodeUnknownOption(VerifiedKeySchema);

/** Better Auth behind the AuthGateway port. */
export const AuthGatewayLive = Layer.effect(
  AuthGateway,
  Effect.gen(function* authGateway() {
    const auth = yield* BetterAuth;
    const db = yield* Drizzle;
    const settings = yield* AuthSettings;
    const trusted = trustedOriginsOf(settings);
    const tokens = yield* makeAccessTokens;

    // The key's workspace, and, when the key records its maker, the role
    // they hold there now (none once they are no longer a member): one
    // read, on the primary key and the members' unique index. A
    // workspace's keys are deleted with it; one that remains, however the
    // workspace went, is no credential.
    const standingOf = (
      workspaceId: WorkspaceId,
      maker: Option.Option<UserId>
    ) =>
      Option.match(maker, {
        onNone: () =>
          db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.id, workspaceId))
            .limit(1)
            .pipe(
              Effect.map((rows) =>
                rows.length === 0
                  ? Option.none()
                  : Option.some(Option.none<string>())
              )
            ),
        onSome: (userId) =>
          db
            .select({ role: member.role })
            .from(organization)
            .leftJoin(
              member,
              and(
                eq(member.organizationId, organization.id),
                eq(member.userId, userId)
              )
            )
            .where(eq(organization.id, workspaceId))
            .limit(1)
            .pipe(
              Effect.map(([row]) =>
                row === undefined
                  ? Option.none()
                  : Option.some(Option.fromNullishOr(row.role))
              )
            ),
      }).pipe(Effect.mapError((cause) => new AuthUnavailable({ cause })));

    // A key past its maker's standing, which a key made while that
    // standing changed may be: revoked, as far as it goes, and refused
    // either way.
    const revokeOutgrown = (apiKeyId: string, workspaceId: WorkspaceId) =>
      db
        .delete(apikey)
        .where(
          and(eq(apikey.id, apiKeyId), eq(apikey.referenceId, workspaceId))
        )
        .pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning(
              "Revoking an API key past its maker's standing failed",
              cause
            )
          ),
          Effect.asVoid
        );

    return AuthGateway.of({
      apiKey: (key) =>
        attempt(
          async () =>
            await auth.api.verifyApiKey({ body: { key: Redacted.value(key) } })
        ).pipe(
          Effect.map(decodeVerifiedKey),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeedNone,
              onSome: ({ key: verified }) =>
                Effect.gen(function* standing() {
                  const permissions = permissionsOf(verified.permissions ?? {});

                  const maker = Option.fromNullishOr(
                    verified.metadata?.createdBy
                  );

                  const found = yield* standingOf(verified.referenceId, maker);

                  if (Option.isNone(found)) {
                    return Option.none();
                  }

                  if (
                    Option.isSome(maker) &&
                    beyondMaker(
                      permissions,
                      maker.value,
                      verified.referenceId,
                      found.value
                    )
                  ) {
                    yield* revokeOutgrown(verified.id, verified.referenceId);

                    return Option.none();
                  }

                  return Option.some(
                    new ApiKeyPrincipal({
                      apiKeyId: verified.id,
                      permissions,
                      workspaceId: verified.referenceId,
                    })
                  );
                }),
            })
          ),
          Effect.withSpan("AuthGateway.apiKey")
        ),
      apiToken: (request) =>
        tokens
          .verify(
            request,
            apiResourceOf(settings.publicUrl),
            ["azp"],
            ApiTokenClaimsSchema
          )
          .pipe(
            Effect.map(principalOf),
            Effect.withSpan("AuthGateway.apiToken")
          ),
      isTrustedOrigin: (origin) => trusted.has(origin),
      mcpCredentialRefused: credentialRefused(
        mcpResourceOf(settings.publicUrl)
      ),
      mcpToken: (request) =>
        tokens
          .verify(
            request,
            mcpResourceOf(settings.publicUrl),
            ["azp", workspaceClaim],
            McpTokenClaimsSchema
          )
          .pipe(
            Effect.map((claims) => ({
              principal: principalOf(claims),
              workspaceId: claims[workspaceClaim],
            })),
            Effect.withSpan("AuthGateway.mcpToken")
          ),
      // Better Auth's own server-only call, which decrypts the codes as its
      // routes do: their count alone is answered.
      recoveryCodesLeft: (userId) =>
        Effect.tryPromise({
          catch: (cause) => new AuthUnavailable({ cause }),
          try: async () => await auth.api.viewBackupCodes({ body: { userId } }),
        }).pipe(
          Effect.map((answer) =>
            decodeCodes(answer).pipe(
              Option.map(({ backupCodes }) => backupCodes.length)
            )
          ),
          Effect.catchIf(
            (error) => isNotEnabled(error.cause),
            () => Effect.succeedNone
          ),
          Effect.withSpan("AuthGateway.recoveryCodesLeft")
        ),
      session: (cookies, { fresh }) =>
        attempt(
          async () =>
            await auth.api.getSession({
              headers: new Headers({ cookie: Redacted.value(cookies) }),
              // Refreshing would set a cookie on a reply this path does not
              // send. The web app's account menu asks Better Auth for the
              // session (GET /api/auth/get-session), which refreshes it.
              query: { disableCookieCache: fresh, disableRefresh: true },
            })
        ).pipe(
          Effect.map((answer) =>
            decodeSession(answer).pipe(
              Option.map(
                ({ session, user }) =>
                  new UserPrincipal({
                    impersonatedBy: Option.fromNullishOr(
                      session.impersonatedBy
                    ),
                    userId: user.id,
                  })
              )
            )
          ),
          Effect.withSpan("AuthGateway.session")
        ),
    });
  })
);
