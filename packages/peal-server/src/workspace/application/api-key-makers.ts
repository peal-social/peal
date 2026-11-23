import { Context, Effect, Layer } from "effect";
import type { Option } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { keysBeyond } from "#workspace/domain/api-key.ts";
import { partnerKeyBeyondMaker } from "#workspace/domain/partner-key.ts";

import { PartnerStore } from "./partner-store.ts";
import { WorkspaceApiKeys } from "./workspace-api-keys.ts";

/** The keys a change of a member's standing revoked, by kind. */
export interface RevokedKeys {
  readonly apiKeyIds: readonly string[];
  /** The partner keys, when the workspace is a partner's home workspace. */
  readonly partnerKeyIds: readonly string[];
}

/**
 * A workspace's API keys, and the partner keys of the partner whose home
 * workspace it is, follow the standing of the members who made them: once
 * a member leaves, is removed or closes their account, the keys they made
 * there stop working; once their role is lowered, so do the API keys the
 * new role could not give (`keysBeyond`), and the partner keys once it no
 * longer manages the partner account (`partnerKeyBeyondMaker`). Keys with
 * no recorded maker are left alone.
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
    ) => Effect.Effect<RevokedKeys, DatabaseError>;
  }
>()("peal-server/workspace/application/ApiKeyMakers") {
  static readonly layer = Layer.effect(
    ApiKeyMakers,
    Effect.gen(function* apiKeyMakers() {
      const keys = yield* WorkspaceApiKeys;
      const partners = yield* PartnerStore;

      const settle = Effect.fn("ApiKeyMakers.settle")(function* settle(
        workspaceId: WorkspaceId,
        userId: UserId,
        role: Option.Option<string>
      ) {
        const beyond = keysBeyond(yield* keys.list(workspaceId), userId, role);

        const apiKeyIds =
          beyond.length === 0
            ? []
            : yield* keys.revoke(
                workspaceId,
                beyond.map(({ id }) => id)
              );

        const partnerKeyIds = partnerKeyBeyondMaker(role)
          ? yield* partners.removeKeysMadeBy(workspaceId, userId)
          : [];

        const revoked: RevokedKeys = { apiKeyIds, partnerKeyIds };

        return revoked;
      });

      return ApiKeyMakers.of({ settle });
    })
  );

  /** Revokes nothing: for tests where no member's standing changes. */
  static readonly none = Layer.succeed(
    ApiKeyMakers,
    ApiKeyMakers.of({
      settle: () => Effect.succeed({ apiKeyIds: [], partnerKeyIds: [] }),
    })
  );
}
