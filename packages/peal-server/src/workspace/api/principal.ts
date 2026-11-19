import { Effect, Option, Schema } from "effect";
import type {
  Member,
  OAuthGrant as ContractGrant,
  Principal as ContractPrincipal,
} from "peal-contract";

import { AnalyticsActor } from "#shared/application/analytics-actor.ts";
import type { Actor } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { ApiKeyPrincipal } from "#workspace/domain/api-key-principal.ts";
import type { OAuthGrant } from "#workspace/domain/oauth-grant.ts";
import {
  PartnerIdSchema,
  PartnerKeyIdSchema,
} from "#workspace/domain/partner-id.ts";
import { PartnerKeyPrincipal } from "#workspace/domain/partner-key-principal.ts";
import type { Principal } from "#workspace/domain/principal.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";

// The contract describes principals for every client; the domain brands
// their ids. These convert between the two at the HTTP boundary.

const toContractGrant = (grant: OAuthGrant): ContractGrant => ({
  clientId: grant.clientId,
  scopes: grant.scopes,
  workspaceId: Option.getOrNull(grant.workspaceId),
});

const grantOf = (grant: ContractGrant): OAuthGrant => ({
  clientId: grant.clientId,
  scopes: grant.scopes,
  workspaceId: Option.fromNullishOr(grant.workspaceId).pipe(
    Option.map((id) => WorkspaceIdSchema.make(id))
  ),
});

export const toContractPrincipal = (
  principal: Principal
): ContractPrincipal => {
  if (principal._tag === "UserPrincipal") {
    return {
      _tag: "user",
      impersonatedBy: Option.getOrNull(principal.impersonatedBy),
      ...Option.match(principal.oauth, {
        onNone: () => ({}),
        onSome: (grant) => ({ oauth: toContractGrant(grant) }),
      }),
      userId: principal.userId,
    };
  }

  return principal._tag === "ApiKeyPrincipal"
    ? {
        _tag: "apiKey",
        apiKeyId: principal.apiKeyId,
        permissions: principal.permissions,
        workspaceId: principal.workspaceId,
      }
    : {
        _tag: "partnerKey",
        partnerId: principal.partnerId,
        partnerKeyId: principal.partnerKeyId,
        permissions: principal.permissions,
        scopes: principal.scopes,
      };
};

export const userPrincipalOf = (
  principal: Extract<ContractPrincipal, { readonly _tag: "user" }>
): UserPrincipal =>
  new UserPrincipal({
    impersonatedBy: Option.fromNullishOr(principal.impersonatedBy).pipe(
      Option.map((id) => UserIdSchema.make(id))
    ),
    oauth: Option.fromUndefinedOr(principal.oauth).pipe(Option.map(grantOf)),
    userId: UserIdSchema.make(principal.userId),
  });

export const partnerKeyPrincipalOf = (
  principal: Extract<ContractPrincipal, { readonly _tag: "partnerKey" }>
): PartnerKeyPrincipal =>
  new PartnerKeyPrincipal({
    partnerId: PartnerIdSchema.make(principal.partnerId),
    partnerKeyId: PartnerKeyIdSchema.make(principal.partnerKeyId),
    permissions: principal.permissions,
    scopes: principal.scopes,
  });

export const principalOf = (principal: ContractPrincipal): Principal => {
  if (principal._tag === "user") {
    return userPrincipalOf(principal);
  }

  return principal._tag === "apiKey"
    ? new ApiKeyPrincipal({
        apiKeyId: principal.apiKeyId,
        permissions: principal.permissions,
        workspaceId: WorkspaceIdSchema.make(principal.workspaceId),
      })
    : partnerKeyPrincipalOf(principal);
};

export const memberOf = (actor: Actor, principal: Principal): Member => ({
  permissions: actor.permissions,
  principal: toContractPrincipal(principal),
  workspaceId: actor.workspaceId,
});

/**
 * Who a principal acts as, for product analytics: a person, and whether
 * staff act as them; nobody for a key, whose events are its workspace's.
 * The web app's session joins only a person in their own session.
 */
export const analyticsActorOf = (
  principal: Principal,
  sessionId: Option.Option<string> = Option.none()
): AnalyticsActor["Service"] =>
  principal._tag === "UserPrincipal"
    ? {
        impersonated: Option.isSome(principal.impersonatedBy),
        sessionId:
          Option.isNone(principal.impersonatedBy) &&
          Option.isNone(principal.oauth)
            ? sessionId
            : Option.none(),
        userId: Option.some(principal.userId),
      }
    : { impersonated: false, sessionId: Option.none(), userId: Option.none() };

/** The header the web app names its measured session in. */
export const browserSessionHeader = "x-posthog-session-id";

const decodeSessionId = Schema.decodeUnknownOption(
  Schema.String.check(Schema.isUUID())
);

/**
 * The web app's measured session a request names, when the value is a
 * UUID (the SDK makes UUIDv7s): anything else is ignored, never refused.
 */
export const browserSessionOf = (
  headers: Readonly<Record<string, string | undefined>>
): Option.Option<string> => decodeSessionId(headers[browserSessionHeader]);

/** The person a member acts as, for product analytics: none for a key. */
export const capturedActorOf = (member: Member) => {
  const { impersonated, userId } = analyticsActorOf(
    principalOf(member.principal)
  );

  return userId.pipe(Option.map((id) => ({ impersonated, userId: id })));
};

/**
 * Provides who the request acts as, for product analytics, with the web
 * app's session the request names, if any.
 */
export const actingAs = (
  principal: Principal,
  sessionId: Option.Option<string> = Option.none()
) =>
  Effect.provideService(AnalyticsActor, analyticsActorOf(principal, sessionId));
