import { Context, Duration, Effect, Layer, Option } from "effect";

import type { Actor, Permission } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import { ApiKeyNotFound } from "#workspace/domain/api-key-not-found.ts";
import type { ApiKey } from "#workspace/domain/api-key.ts";
import { grantableBy } from "#workspace/domain/api-key.ts";
import type { PermissionNotGrantable } from "#workspace/domain/permission-not-grantable.ts";
import { UserRequired } from "#workspace/domain/user-required.ts";

import { ApiKeyIssuer } from "./api-key-issuer.ts";
import type { IssuedApiKey } from "./api-key-issuer.ts";
import type { AuthUnavailable } from "./auth-unavailable.ts";
import type { DirectoryUnavailable } from "./directory-unavailable.ts";
import { WorkspacePeople } from "./workspace-people.ts";

export interface NewApiKey {
  readonly expiresInDays: Option.Option<number>;
  readonly name: string;
  readonly permissions: readonly Permission[];
}

/** The member who made a key, by the name they go by. */
export interface KeyMaker {
  readonly id: UserId;
  readonly name: string;
}

/**
 * A key as the list shows it: with its maker while they are a member of
 * the workspace; none for a key made before Peal recorded makers, or
 * whose maker is no longer a member.
 */
export interface ListedApiKey {
  readonly apiKey: ApiKey;
  readonly maker: Option.Option<KeyMaker>;
}

/** A key just made, with the key itself, to show once. */
export interface CreatedApiKey extends IssuedApiKey, ListedApiKey {}

/** A workspace's API keys: created by members, used by scripts. */
export class ApiKeys extends Context.Service<
  ApiKeys,
  {
    readonly create: (
      actor: Actor,
      key: NewApiKey
    ) => Effect.Effect<
      CreatedApiKey,
      | AuthUnavailable
      | DirectoryUnavailable
      | MissingPermission
      | PermissionNotGrantable
      | UserRequired
    >;
    readonly list: (
      actor: Actor
    ) => Effect.Effect<
      readonly ListedApiKey[],
      AuthUnavailable | DirectoryUnavailable | MissingPermission
    >;
    readonly revoke: (
      actor: Actor,
      apiKeyId: string
    ) => Effect.Effect<
      void,
      ApiKeyNotFound | AuthUnavailable | MissingPermission
    >;
  }
>()("peal-server/workspace/application/ApiKeys") {
  static readonly layer = Layer.effect(
    ApiKeys,
    Effect.gen(function* apiKeys() {
      const issuer = yield* ApiKeyIssuer;
      const people = yield* WorkspacePeople;

      // Each key with its maker, named as the workspace's members are:
      // none once they are no longer one.
      const withMakers = Effect.fn("ApiKeys.withMakers")(function* withMakers(
        workspaceId: WorkspaceId,
        keys: readonly ApiKey[]
      ) {
        const names = keys.every(({ createdBy }) => Option.isNone(createdBy))
          ? new Map<UserId, string>()
          : new Map(
              (yield* people.members(workspaceId)).map(
                ({ name, userId }) => [userId, name] as const
              )
            );

        return keys.map((apiKey): ListedApiKey => ({
          apiKey,
          maker: apiKey.createdBy.pipe(
            Option.flatMap((id) =>
              Option.fromUndefinedOr(names.get(id)).pipe(
                Option.map((name) => ({ id, name }))
              )
            )
          ),
        }));
      });

      const create = Effect.fn("ApiKeys.create")(function* create(
        actor: Actor,
        key: NewApiKey
      ) {
        yield* Effect.fromResult(authorize(actor, "apiKey:create"));

        const { subject } = actor;

        if (subject._tag !== "user") {
          return yield* new UserRequired();
        }

        const permissions = yield* Effect.fromResult(
          grantableBy(actor, key.permissions)
        );

        const issued = yield* issuer.issue({
          createdBy: subject.userId,
          expiresIn: key.expiresInDays.pipe(Option.map(Duration.days)),
          name: key.name,
          permissions,
          workspaceId: actor.workspaceId,
        });

        const [listed] = yield* withMakers(actor.workspaceId, [issued.apiKey]);

        const created: CreatedApiKey = {
          ...issued,
          maker: listed?.maker ?? Option.none(),
        };

        return created;
      });

      const list = Effect.fn("ApiKeys.list")(function* list(actor: Actor) {
        yield* Effect.fromResult(authorize(actor, "apiKey:read"));

        return yield* withMakers(
          actor.workspaceId,
          yield* issuer.list(actor.workspaceId)
        );
      });

      const revoke = Effect.fn("ApiKeys.revoke")(function* revoke(
        actor: Actor,
        apiKeyId: string
      ) {
        yield* Effect.fromResult(authorize(actor, "apiKey:delete"));

        const revoked = yield* issuer.revoke(actor.workspaceId, apiKeyId);

        yield* revoked
          ? Effect.void
          : Effect.fail(
              new ApiKeyNotFound({ apiKeyId, workspaceId: actor.workspaceId })
            );
      });

      return ApiKeys.of({ create, list, revoke });
    })
  );
}
