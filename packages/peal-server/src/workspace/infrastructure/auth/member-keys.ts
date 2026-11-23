import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import type { GenericEndpointContext } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import { Option, Schema } from "effect";

import { rolesOf } from "#workspace/domain/roles.ts";

/** A member's standing about to change in a workspace. */
export interface MemberStandingChange {
  /** The role they are given; null once they are no longer a member. */
  readonly role: string | null;
  readonly userId: string;
  readonly workspaceId: string;
}

/**
 * Revokes the API keys the member made in the workspace that their new
 * standing does not cover, and answers their ids. A failure throws.
 */
export type MemberKeysSettler = (
  change: MemberStandingChange
) => Promise<readonly string[]>;

// The keys a request revoked, for its workspace's activity log, which its
// after hook keeps.
const revoked = new WeakMap<Request, readonly string[]>();

/** The API keys this request revoked as its member's standing changed. */
export const revokedKeysOf = (request: Request): readonly string[] =>
  revoked.get(request) ?? [];

/**
 * Before a member's standing changes, once the route has checked the
 * rest: the keys they made that it no longer covers go first, so a change
 * that fails after them leaves a member without those keys, never keys
 * past their maker's standing. What this request revoked is noted for
 * the activity log.
 */
export const settleMemberKeys = async (
  settle: MemberKeysSettler,
  change: MemberStandingChange,
  request: Request | undefined = tryGetCurrentAuthEndpointContext()?.request
): Promise<void> => {
  const ids = await settle(change);

  if (request !== undefined && ids.length > 0) {
    revoked.set(request, [...revokedKeysOf(request), ...ids]);
  }
};

/**
 * Once a member's standing changed: their keys are settled again, as one
 * they made while the change ran was made under the standing it ended. A
 * failure is logged, as the change is done and the keys before it went
 * first (`settleMemberKeys`).
 */
export const sweepMemberKeys = async (
  hooks: {
    readonly log: (level: "error", message: string) => void;
    readonly memberKeys: MemberKeysSettler;
  },
  change: MemberStandingChange,
  request: Request | undefined = tryGetCurrentAuthEndpointContext()?.request
): Promise<void> => {
  try {
    await settleMemberKeys(hooks.memberKeys, change, request);
  } catch {
    hooks.log(
      "error",
      "Revoking the API keys of a member whose standing changed failed after the change"
    );
  }
};

// What `/organization/leave` answers once the member left: their
// membership, as it was.
const decodeLeft = Schema.decodeUnknownOption(
  Schema.Struct({
    returned: Schema.Struct({
      organizationId: Schema.String,
      userId: Schema.String,
    }),
  })
);

/** After Better Auth's `/organization/leave`: `sweepMemberKeys`. */
export const sweepLeftMemberKeys = async (
  ctx: GenericEndpointContext,
  hooks: Parameters<typeof sweepMemberKeys>[0]
): Promise<void> => {
  if (ctx.path !== "/organization/leave") {
    return;
  }

  const left = decodeLeft(ctx.context);

  if (Option.isSome(left)) {
    await sweepMemberKeys(
      hooks,
      {
        role: null,
        userId: left.value.returned.userId,
        workspaceId: left.value.returned.organizationId,
      },
      ctx.request
    );
  }
};

const decodeLeaveBody = Schema.decodeUnknownOption(
  Schema.Struct({ organizationId: Schema.String })
);

const MemberRowsSchema = Schema.Array(
  Schema.Struct({ role: Schema.String, userId: Schema.String })
);

const decodeMembers = Schema.decodeUnknownOption(MemberRowsSchema);

const owns = (role: string) => rolesOf(role).includes("owner");

/**
 * Before Better Auth's `/organization/leave`, which calls no hook of its
 * own: the leaving member's keys go, unless the route will refuse them
 * (not a member, or the workspace's only owner).
 */
export const settleLeavingMemberKeys = async (
  ctx: GenericEndpointContext,
  settle: MemberKeysSettler
): Promise<void> => {
  if (ctx.path !== "/organization/leave") {
    return;
  }

  const body = decodeLeaveBody(ctx.body);
  const session = await getSessionFromCtx(ctx);

  if (Option.isNone(body) || session === null) {
    return;
  }

  const { organizationId } = body.value;
  const userId = session.user.id;

  const members = decodeMembers(
    await ctx.context.adapter.findMany({
      model: "member",
      where: [{ field: "organizationId", value: organizationId }],
    })
  ).pipe(Option.getOrElse(() => []));

  const leaving = members.find((member) => member.userId === userId);

  if (leaving === undefined) {
    return;
  }

  if (
    owns(leaving.role) &&
    members.filter((member) => owns(member.role)).length <= 1
  ) {
    return;
  }

  await settleMemberKeys(
    settle,
    { role: null, userId, workspaceId: organizationId },
    ctx.request
  );
};
