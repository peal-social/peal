import {
  getCurrentAdapter,
  getCurrentAuthEndpointContext,
  runWithTransaction,
} from "@better-auth/core/context";
import type { GenericEndpointContext, User } from "better-auth";
import { Option, Schema } from "effect";

import { confirmUnconfirmed, wasUsed } from "./sign-up-browser.ts";
import { disconnectAfterPasswordReset } from "./tokens-not-before.ts";

// A password reset proves the address as a confirmation link does: the
// reset link went to it. So a reset confirms an unconfirmed account. Where
// accounts work before their address is confirmed, someone may have made
// the account with the address and used it: the owner, resetting, would
// then hold workspaces whose API keys the maker kept. Those keys go, in the
// workspaces the account alone belongs to, and the reset's answer says how
// many (`apiKeysRemoved`), which the reset page tells.

type AuthCtx = Pick<GenericEndpointContext, "context">;

// What a reset removed, by request, for the route's after hook.
const removed = new WeakMap<Request, number>();

const decodeMembership = Schema.decodeUnknownOption(
  Schema.Struct({ organizationId: Schema.String })
);

// The workspaces the user alone belongs to.
const soleWorkspacesOf = async (
  ctx: AuthCtx,
  userId: string
): Promise<readonly string[]> => {
  const adapter = await getCurrentAdapter(ctx.context.adapter);

  const memberships: readonly unknown[] = await adapter.findMany({
    model: "member",
    where: [{ field: "userId", value: userId }],
  });

  const workspaces = memberships.flatMap((row) =>
    Option.toArray(decodeMembership(row)).map(
      ({ organizationId }) => organizationId
    )
  );

  const counted = await Promise.all(
    workspaces.map(async (workspaceId) => ({
      members: await adapter.count({
        model: "member",
        where: [{ field: "organizationId", value: workspaceId }],
      }),
      workspaceId,
    }))
  );

  return counted
    .filter(({ members }) => members === 1)
    .map(({ workspaceId }) => workspaceId);
};

/**
 * Part of a password reset (`onPasswordReset`): confirms an unconfirmed
 * account, holding its row; when it was used before, deletes the API keys
 * made before now in the workspaces it alone belongs to. Says how many.
 */
export const confirmOnReset = async (
  ctx: AuthCtx,
  userId: string,
  request: Request | undefined
): Promise<void> => {
  const count = await runWithTransaction(ctx.context.adapter, async () => {
    if (!(await confirmUnconfirmed(ctx, userId))) {
      return 0;
    }

    if (!(await wasUsed(ctx, userId))) {
      return 0;
    }

    const adapter = await getCurrentAdapter(ctx.context.adapter);
    const now = new Date();
    const sole = await soleWorkspacesOf(ctx, userId);

    if (sole.length === 0) {
      return 0;
    }

    return await adapter.deleteMany({
      model: "apikey",
      where: [
        { field: "referenceId", operator: "in", value: [...sole] },
        { field: "createdAt", operator: "lt", value: now },
      ],
    });
  });

  if (request !== undefined && count > 0) {
    removed.set(request, count);
  }
};

/**
 * Better Auth's `emailAndPassword.onPasswordReset`: ends what the old
 * password let in (`disconnectAfterPasswordReset`), then confirms the
 * address the reset proved (`confirmOnReset`).
 */
export const afterPasswordReset = async (
  data: { readonly user: User },
  request?: Request
): Promise<void> => {
  await disconnectAfterPasswordReset(data);
  await confirmOnReset(getCurrentAuthEndpointContext(), data.user.id, request);
};

const isResetDone = Schema.is(
  Schema.Struct({ returned: Schema.Struct({ status: Schema.Literal(true) }) })
);

/**
 * Part of Better Auth's after hook, on `/reset-password`: an answer that
 * removed API keys says how many (`apiKeysRemoved`): the answer to put in
 * the route's place, or undefined to leave it as it is.
 */
/** What a reset that removed API keys answers. */
export interface RemovedKeysAnswer {
  readonly apiKeysRemoved: number;
  readonly status: boolean;
}

export const tellRemovedKeys = async (
  ctx: GenericEndpointContext
): Promise<RemovedKeysAnswer | undefined> => {
  const count =
    ctx.path === "/reset-password" && ctx.request !== undefined
      ? removed.get(ctx.request)
      : undefined;

  return count === undefined || !isResetDone(ctx.context)
    ? undefined
    : await ctx.json({ apiKeysRemoved: count, status: true });
};
