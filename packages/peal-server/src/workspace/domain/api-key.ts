import { Option, Result, Schema } from "effect";

import { Actor, can, PermissionSchema } from "#shared/domain/access.ts";
import type { Permission } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";

import { personOnlyPermissions } from "./oauth-grant.ts";
import { PermissionNotGrantable } from "./permission-not-grantable.ts";
import { permissionsFor } from "./roles.ts";
import type { Role } from "./roles.ts";

/**
 * An API key of a workspace, as it is listed. The key itself is shown once,
 * when it is created, and stored only hashed.
 */
export class ApiKey extends Schema.Class<ApiKey>(
  "peal-server/workspace/domain/ApiKey"
)({
  createdAt: Schema.DateTimeUtc,
  // The member who made it; none for a key made before Peal recorded its
  // maker.
  createdBy: Schema.Option(UserIdSchema),
  expiresAt: Schema.Option(Schema.DateTimeUtc),
  id: Schema.NonEmptyString,
  name: Schema.String,
  permissions: Schema.Array(PermissionSchema),
  // Its first characters, prefix included, to tell keys apart.
  start: Schema.Option(Schema.String),
  workspaceId: WorkspaceIdSchema,
}) {}

// The direct messages' permissions: a key that holds them reads and
// answers private correspondence with no further leave, so it is the
// owner's leave itself.
const messagePermissions: ReadonlySet<Permission> = new Set([
  "engagement:readMessages",
  "engagement:message",
]);

// An owner (`organization:secure`) in their own session: not an
// application acting for them, nor staff acting as them.
const ownerInPerson = (actor: Actor) =>
  actor.subject._tag === "user" &&
  actor.subject.clientId === undefined &&
  Option.isNone(actor.subject.impersonatedBy) &&
  can(actor, "organization:secure");

/**
 * The permissions a member may give a new API key, once each and in
 * vocabulary order: only ones they hold themselves, so a key never does
 * more than its creator could, and never one only a person in their own
 * session uses (`personOnlyPermissions`: deciding what ads may spend).
 * The direct messages' (`engagement:readMessages`, `engagement:message`)
 * only an owner in person gives, as they let an application in.
 */
export const grantableBy = (
  actor: Actor,
  requested: readonly Permission[]
): Result.Result<
  readonly Permission[],
  MissingPermission | PermissionNotGrantable
> => {
  const personal = requested.find((permission) =>
    personOnlyPermissions.has(permission)
  );

  if (personal !== undefined) {
    return Result.fail(new PermissionNotGrantable({ permission: personal }));
  }

  const correspondence = ownerInPerson(actor)
    ? undefined
    : requested.find((permission) => messagePermissions.has(permission));

  if (correspondence !== undefined) {
    return Result.fail(
      new PermissionNotGrantable({ permission: correspondence })
    );
  }

  const missing = requested.find((permission) => !can(actor, permission));

  return missing === undefined
    ? Result.succeed(
        PermissionSchema.literals.filter((permission) =>
          requested.includes(permission)
        )
      )
    : Result.fail(new MissingPermission({ permission: missing }));
};

// The actor a member is, in person, in a workspace where they hold `role`
// (as Better Auth stores it): what a key they made there may hold.
const inPerson = (userId: UserId, workspaceId: WorkspaceId, role: string) =>
  new Actor({
    permissions: permissionsFor(role),
    subject: { _tag: "user", impersonatedBy: Option.none(), userId },
    workspaceId,
  });

/**
 * The keys `userId` made that their standing in the workspace no longer
 * covers: every one once they are no longer a member (`role` none) and,
 * holding `role`, those with a permission that role could not give a new
 * key (`grantableBy`), so a key never does more than its maker could. A
 * key with no recorded maker is left alone.
 */
export const keysBeyond = (
  keys: readonly ApiKey[],
  userId: UserId,
  role: Option.Option<string>
): readonly ApiKey[] =>
  keys.filter(
    (key) =>
      Option.contains(key.createdBy, userId) &&
      Option.match(role, {
        onNone: () => true,
        onSome: (held) =>
          Result.isFailure(
            grantableBy(inPerson(userId, key.workspaceId, held), [
              ...key.permissions,
            ])
          ),
      })
  );

/**
 * How many of the keys a member made would stop working: if they left
 * the workspace (`removal`), and if their role became each role.
 */
export interface KeysAtStake {
  readonly removal: number;
  readonly roles: Readonly<Record<Role, number>>;
}

/** What `keysBeyond` would revoke of `userId`'s keys, counted. */
export const keysAtStake = (
  keys: readonly ApiKey[],
  userId: UserId
): KeysAtStake => {
  const beyond = (role: Role) =>
    keysBeyond(keys, userId, Option.some(role)).length;

  return {
    removal: keysBeyond(keys, userId, Option.none()).length,
    roles: {
      admin: beyond("admin"),
      contributor: beyond("contributor"),
      editor: beyond("editor"),
      owner: beyond("owner"),
      viewer: beyond("viewer"),
    },
  };
};
