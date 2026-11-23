import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import type { ApiKey } from "#workspace/domain/api-key.ts";

/**
 * The API keys a workspace holds, as stored, with who made each: read and
 * revoked on the server's own database, inside the caller's transaction
 * when there is one. Creating a key goes through `ApiKeyIssuer`, which
 * hashes it.
 */
export class WorkspaceApiKeys extends Context.Service<
  WorkspaceApiKeys,
  {
    /** The workspace's keys, oldest first. */
    readonly list: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<readonly ApiKey[], DatabaseError>;
    /** Revokes these keys of the workspace: the ids of those it had. */
    readonly revoke: (
      workspaceId: WorkspaceId,
      apiKeyIds: readonly string[]
    ) => Effect.Effect<readonly string[], DatabaseError>;
  }
>()("peal-server/workspace/application/WorkspaceApiKeys") {}
