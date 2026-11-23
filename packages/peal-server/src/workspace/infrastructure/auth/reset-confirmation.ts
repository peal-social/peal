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
// then hold workspaces whose ways in the maker kept. In every workspace the
// account is the only owner of, the API keys made before the reset and the
// pending invitations go, in the transaction that confirms; the members
// stay (a real, never-confirmed user's team would be hit otherwise), and
// the reset's answer always says the account was used before
// (`usedBeforeConfirmation`), with what went, so the reset page tells the
// person what to check.

type AuthCtx = Pick<GenericEndpointContext, "context">;

/** What a reset of an account used before its confirmation removed. */
export interface TakenBack {
  readonly apiKeysRemoved: number;
  readonly invitationsCancelled: number;
}

// What a reset removed, by request, for the route's after hook.
const removed = new WeakMap<Request, TakenBack>();

const MembershipSchema = Schema.Struct({
  organizationId: Schema.String,
  role: Schema.String,
});

const decodeMemberships = Schema.decodeUnknownOption(
  Schema.Array(MembershipSchema)
);

// The workspaces the user is the only owner of, whoever else belongs.
const ownedAloneBy = async (
  ctx: AuthCtx,
  userId: string
): Promise<readonly string[]> => {
  const adapter = await getCurrentAdapter(ctx.context.adapter);

  const own = Option.getOrElse(
    decodeMemberships(
      await adapter.findMany({
        model: "member",
        where: [{ field: "userId", value: userId }],
      })
    ),
    () => []
  ).filter(({ role }) => role === "owner");

  const owners = await Promise.all(
    own.map(async ({ organizationId }) => ({
      count: await adapter.count({
        model: "member",
        where: [
          { field: "organizationId", value: organizationId },
          { field: "role", value: "owner" },
        ],
      }),
      organizationId,
    }))
  );

  return owners
    .filter(({ count }) => count === 1)
    .map(({ organizationId }) => organizationId);
};

/**
 * Part of a password reset (`onPasswordReset`): confirms an unconfirmed
 * account, holding its row; when it was used before, deletes the API keys
 * made before now and the pending invitations in every workspace it is the
 * only owner of. Says what went, zero included.
 */
export const confirmOnReset = async (
  ctx: AuthCtx,
  userId: string,
  request: Request | undefined
): Promise<void> => {
  const taken = await runWithTransaction(
    ctx.context.adapter,
    async (): Promise<TakenBack | undefined> => {
      if (
        !(await confirmUnconfirmed(ctx, userId)) ||
        !(await wasUsed(ctx, userId))
      ) {
        return undefined;
      }

      const adapter = await getCurrentAdapter(ctx.context.adapter);
      const owned = await ownedAloneBy(ctx, userId);

      if (owned.length === 0) {
        return { apiKeysRemoved: 0, invitationsCancelled: 0 };
      }

      const apiKeysRemoved = await adapter.deleteMany({
        model: "apikey",
        where: [
          { field: "referenceId", operator: "in", value: [...owned] },
          { field: "createdAt", operator: "lt", value: new Date() },
        ],
      });

      const invitationsCancelled = await adapter.deleteMany({
        model: "invitation",
        where: [
          { field: "organizationId", operator: "in", value: [...owned] },
          { field: "status", value: "pending" },
        ],
      });

      return { apiKeysRemoved, invitationsCancelled };
    }
  );

  if (request !== undefined && taken !== undefined) {
    removed.set(request, taken);
  }
};

/**
 * Better Auth's `emailAndPassword.onPasswordReset`: ends what the old
 * password let in (`disconnectAfterPasswordReset`), confirms the address
 * the reset proved (`confirmOnReset`), then ends the account's sessions
 * once more: a password sign-in that read the old password may have
 * written one after the library's own sweep.
 */
export const afterPasswordReset = async (
  data: { readonly user: User },
  request?: Request
): Promise<void> => {
  const ctx = getCurrentAuthEndpointContext();

  await disconnectAfterPasswordReset(data);
  await confirmOnReset(ctx, data.user.id, request);
  await ctx.context.internalAdapter.deleteUserSessions(data.user.id);

  // A second step begun with the old password (the two-factor plugin's
  // challenges, `2fa-` rows valued with the user's id) can no longer end in
  // a session.
  await ctx.context.adapter.deleteMany({
    model: "verification",
    where: [
      { field: "value", value: data.user.id },
      { field: "identifier", operator: "starts_with", value: "2fa-" },
    ],
  });
};

const isResetDone = Schema.is(
  Schema.Struct({ returned: Schema.Struct({ status: Schema.Literal(true) }) })
);

/** What a reset of an account used before its confirmation answers. */
export interface TakenBackAnswer extends TakenBack {
  readonly status: boolean;
  readonly usedBeforeConfirmation: true;
}

/**
 * Part of Better Auth's after hook, on `/reset-password`: the answer to put
 * in the route's place when the reset took back an account used before its
 * confirmation, or undefined to leave it as it is.
 */
export const tellTakenBack = async (
  ctx: GenericEndpointContext
): Promise<TakenBackAnswer | undefined> => {
  const taken =
    ctx.path === "/reset-password" && ctx.request !== undefined
      ? removed.get(ctx.request)
      : undefined;

  return taken === undefined || !isResetDone(ctx.context)
    ? undefined
    : await ctx.json({
        ...taken,
        status: true,
        usedBeforeConfirmation: true as const,
      });
};
