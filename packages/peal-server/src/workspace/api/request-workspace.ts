import { Option, Schema } from "effect";
import { workspaceHeader } from "peal-contract";

import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { ownWorkspaceOf } from "#workspace/domain/principal.ts";
import type { Principal } from "#workspace/domain/principal.ts";

const decodeWorkspaceId = Schema.decodeUnknownOption(WorkspaceIdSchema);

/**
 * The workspace a request names, as it was sent: its `Peal-Workspace`
 * header, else the workspace its credential belongs to (an API key's, or
 * the one an application's token is bound to), else none. Nothing here
 * says the caller may act in it: `WorkspaceAccess` decides.
 */
export const namedWorkspace = (
  principal: Principal,
  headers: Readonly<Record<string, string | undefined>>
): Option.Option<string> =>
  Option.fromUndefinedOr(headers[workspaceHeader]).pipe(
    Option.orElse(() => ownWorkspaceOf(principal))
  );

/** A workspace's id, when the value has the shape of one. */
export const workspaceIdOf = (value: string): Option.Option<WorkspaceId> =>
  decodeWorkspaceId(value);

/**
 * The workspace a request names, when it has the shape of a workspace's
 * id: what the rate limit, the connection journal and the impersonation
 * guard take, before `WorkspaceAccess` checked it.
 */
export const actingIn = (
  principal: Principal,
  headers: Readonly<Record<string, string | undefined>>
): Option.Option<WorkspaceId> =>
  namedWorkspace(principal, headers).pipe(Option.flatMap(workspaceIdOf));
