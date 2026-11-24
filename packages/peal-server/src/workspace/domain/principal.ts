import { Option, Schema } from "effect";

import type { WorkspaceId } from "#shared/domain/ids.ts";

import { ApiKeyPrincipal } from "./api-key-principal.ts";
import { PartnerKeyPrincipal } from "./partner-key-principal.ts";
import { UserPrincipal } from "./user-principal.ts";

/** Whoever a request authenticates as, before any workspace is involved. */
export const PrincipalSchema = Schema.Union([
  UserPrincipal,
  ApiKeyPrincipal,
  PartnerKeyPrincipal,
]);

export type Principal = typeof PrincipalSchema.Type;

/**
 * The workspace a credential belongs to, which its requests act in when
 * they name none: an API key's, or the one an application's token is bound
 * to. A person's session, the command line's token and a partner key
 * belong to none.
 */
export const ownWorkspaceOf = (
  principal: Principal
): Option.Option<WorkspaceId> => {
  if (principal._tag === "ApiKeyPrincipal") {
    return Option.some(principal.workspaceId);
  }

  return principal._tag === "UserPrincipal"
    ? principal.oauth.pipe(Option.flatMap(({ workspaceId }) => workspaceId))
    : Option.none();
};
