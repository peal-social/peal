import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { Option, Schema } from "effect";

// Better Auth's password sign-in reads the credential, verifies the
// password, then writes a session, with no lock: a release, a takeover or a
// password reset that commits in between ends every session before the
// sign-in's is written, and the sign-in's survives. So the before hook
// notes the password hash the account holds as the sign-in starts, and the
// after hook reads it again once the session is written: a credential gone
// or changed meanwhile deletes that session, expires its cookie and
// answers as a wrong password does.

// The hash an account held as its sign-in started, by request.
const started = new WeakMap<
  Request,
  { readonly hash: string | null; readonly userId: string }
>();

const signInPath = "/sign-in/email";

const decodeEmail = Schema.decodeUnknownOption(
  Schema.Struct({ email: Schema.String })
);

const hashOf = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<string | null> => {
  const credential =
    await ctx.context.internalAdapter.findCredentialAccount(userId);

  return credential?.password ?? null;
};

/** Part of Better Auth's before hook: notes the account's hash. */
export const noteSignInCredential = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const email = decodeEmail(ctx.body);

  if (
    ctx.path !== signInPath ||
    ctx.request === undefined ||
    Option.isNone(email)
  ) {
    return;
  }

  const found = await ctx.context.internalAdapter.findUserByEmail(
    email.value.email.toLowerCase()
  );

  if (found !== null) {
    started.set(ctx.request, {
      hash: await hashOf(ctx, found.user.id),
      userId: found.user.id,
    });
  }
};

/**
 * Part of Better Auth's after hook: a password sign-in whose account's
 * credential went or changed while it ran keeps no session.
 */
export const refuseStaleSignIn = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const noted =
    ctx.path === signInPath && ctx.request !== undefined
      ? started.get(ctx.request)
      : undefined;

  const created = ctx.context.newSession;

  if (
    noted === undefined ||
    created === null ||
    created.user.id !== noted.userId
  ) {
    return;
  }

  const now = await hashOf(ctx, noted.userId);

  if (now !== null && now === noted.hash) {
    return;
  }

  await ctx.context.internalAdapter.deleteSession(created.session.token);
  deleteSessionCookie(ctx);

  throw APIError.from("UNAUTHORIZED", {
    code: "INVALID_EMAIL_OR_PASSWORD",
    message: "Invalid email or password",
  });
};
