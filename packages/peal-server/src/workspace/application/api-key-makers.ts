import { Context, Effect, Layer } from "effect";
import type { Option } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { keysBeyond } from "#workspace/domain/api-key.ts";

import { WorkspaceApiKeys } from "./workspace-api-keys.ts";

/**
 * A workspace's API keys follow the standing of the members who made them:
 * once a member leaves, is removed or closes their account, the keys they
 * made there stop working, and once their role is lowered, so do those
 * the new role could not give (`keysBeyond`). Keys with no recorded maker
 * are left alone.
 */
export class ApiKeyMakers extends Context.Service<
  ApiKeyMakers,
  {
    /**
     * Revokes the keys `userId` made in the workspace that `role`, the
     * role they hold or are given there (none: no longer a member), does
     * not cover, and answers their ids.
     */
    readonly settle: (
      workspaceId: WorkspaceId,
      userId: UserId,
      role: Option.Option<string>
    ) => Effect.Effect<readonly string[], DatabaseError>;
  }
>()("peal-server/workspace/application/ApiKeyMakers") {
  static readonly layer = Layer.effect(
    ApiKeyMakers,
    Effect.gen(function* apiKeyMakers() {
      const keys = yield* WorkspaceApiKeys;

      const settle = Effect.fn("ApiKeyMakers.settle")(function* settle(
        workspaceId: WorkspaceId,
        userId: UserId,
        role: Option.Option<string>
      ) {
        const beyond = keysBeyond(yield* keys.list(workspaceId), userId, role);

        return beyond.length === 0
          ? []
          : yield* keys.revoke(
              workspaceId,
              beyond.map(({ id }) => id)
            );
      });

      return ApiKeyMakers.of({ settle });
    })
  );

  /** Revokes nothing: for tests where no member's standing changes. */
  static readonly none = Layer.succeed(
    ApiKeyMakers,
    ApiKeyMakers.of({ settle: () => Effect.succeed([]) })
  );
}
