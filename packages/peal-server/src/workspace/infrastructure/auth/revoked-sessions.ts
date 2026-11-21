import type { GenericEndpointContext } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";

import { refusedWhileImpersonating } from "./impersonation.ts";

/**
 * Part of Better Auth's before hook, ahead of every other part: a browser's
 * request to a route whose effect outlives the session (those
 * `refusedWhileImpersonating` lists: a workspace's changes, an OAuth
 * client's access, the account's changes) is served only in a session the
 * database still holds. The copy cached in a cookie stays readable for
 * five minutes after a sign-out everywhere, a password reset or a ban
 * deleted the session; Peal's API reads writes' sessions fresh for the same
 * reason. The session read here is the one the route and the later hooks
 * reuse.
 */
export const refuseRevokedSessions = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const { request } = ctx;

  if (
    request === undefined ||
    !request.headers.has("cookie") ||
    !refusedWhileImpersonating(ctx.path)
  ) {
    return;
  }

  const stored = await getSessionFromCtx(ctx, {
    disableCookieCache: true,
    disableRefresh: true,
  });

  if (stored !== null) {
    return;
  }

  // The database holds none: a cookie that still names one is refused,
  // where reading the session again would take the cached copy.
  if ((await getSessionFromCtx(ctx, { disableRefresh: true })) !== null) {
    throw APIError.from("UNAUTHORIZED", {
      code: "SESSION_ENDED",
      message: "This session has ended: sign in again",
    });
  }
};
