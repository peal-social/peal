import { getCurrentAuthEndpointContext } from "@better-auth/core/context";
import type { GenericEndpointContext, User } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { Option, Result, Schema } from "effect";
import { Base64Url } from "effect/encoding";

import { forgetConnectedApplications } from "./connected-applications.ts";
import { tokensNotBeforeOf } from "./sign-up-binding.ts";

// A password reset, or the release of an unconfirmed account, ends what the
// old password let in. Deleting the OAuth provider's rows stops renewals,
// but an access token already issued is a JWT, checked where it is used,
// and a renewal in flight may write its new tokens just after the rows
// went. So the account also keeps an instant (`auth.verification`, row
// `tokens-not-before:<userId>`): a bearer token issued before it is
// refused (`issuedBeforeReset`), and a renewal that started before it
// gives nothing back (`refuseRenewalAcrossReset`).

type AuthCtx = Pick<GenericEndpointContext, "context">;

// Longer than an access token lives (15 minutes): past it, every token
// issued before the instant has expired anyway.
const keptFor = 60 * 60 * 1000;

// How long after the instant a renewal that started is still taken as one
// in flight across it: a renewal's reads and writes take far less.
const inFlight = 5000;

/**
 * Keeps now as the instant before which the account's bearer tokens no
 * longer work. Written before the tokens are deleted, so a renewal that
 * reads them afterwards finds the instant.
 */
export const markTokensNotBefore = async (
  ctx: AuthCtx,
  userId: string
): Promise<void> => {
  const { internalAdapter } = ctx.context;
  const identifier = tokensNotBeforeOf(userId);
  const now = Date.now();

  await internalAdapter.deleteVerificationByIdentifier(identifier);
  await internalAdapter.createVerificationValue({
    expiresAt: new Date(now + keptFor),
    identifier,
    value: String(now),
  });
};

/**
 * Better Auth's `emailAndPassword.onPasswordReset`: a new password, chosen
 * from the emailed link, ends what the old one let in. Better Auth ends the
 * sessions (`revokeSessionsOnPasswordReset`); the connected applications go
 * here, as a stolen password could have connected one, and the bearer
 * tokens issued before now stop working, the instant written first so a
 * renewal in flight finds it.
 */
export const disconnectAfterPasswordReset = async ({
  user,
}: {
  readonly user: User;
}): Promise<void> => {
  const ctx = getCurrentAuthEndpointContext();

  await markTokensNotBefore(ctx, user.id);
  await forgetConnectedApplications(ctx, user.id);
};

const decodeInstant = Schema.decodeUnknownOption(Schema.NumberFromString);

/** The account's instant, in milliseconds, while it holds one. */
export const tokensNotBefore = async (
  internalAdapter: AuthCtx["context"]["internalAdapter"],
  userId: string
): Promise<Option.Option<number>> => {
  const found = await internalAdapter.findVerificationValue(
    tokensNotBeforeOf(userId)
  );

  return found === null || found.expiresAt.getTime() < Date.now()
    ? Option.none()
    : decodeInstant(found.value);
};

/**
 * Whether an access token issued at `iat` (seconds, as JWTs count) is
 * older than the account's instant. A token of the instant's second is
 * refused too: its second does not tell before from after.
 */
export const issuedBeforeReset = (
  iat: number,
  notBefore: Option.Option<number>
): boolean =>
  Option.exists(notBefore, (instant) => iat * 1000 < instant + 1000);

// When each token request started, for its after hook.
const started = new WeakMap<Request, number>();

/** Part of Better Auth's before hook: notes when a token request started. */
export const noteTokenRequest = (ctx: GenericEndpointContext): void => {
  if (ctx.path === "/oauth2/token" && ctx.request !== undefined) {
    started.set(ctx.request, Date.now());
  }
};

const decodeIssued = Schema.decodeUnknownOption(
  Schema.Struct({ returned: Schema.Struct({ access_token: Schema.String }) })
);

const decodeSubject = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ sub: Schema.String }))
);

// The subject of an access token the route just issued: its own, so its
// payload is read without checking the signature again.
const subjectOf = (token: string): Option.Option<string> =>
  Option.fromNullishOr(token.split(".")[1]).pipe(
    Option.flatMap((payload) =>
      Result.getSuccess(Base64Url.decodeString(payload))
    ),
    Option.flatMap(decodeSubject),
    Option.map(({ sub }) => sub)
  );

/**
 * Part of Better Auth's after hook, on `/oauth2/token`: any grant (a
 * renewal, a code's exchange, the command line's device code) that started
 * before the account's instant, or just after it while the deletion ran,
 * and still issued tokens, wrote them after they were deleted. Its tokens go too, the instant moves to now so its access token
 * is refused, and the client is answered `invalid_grant`.
 */
export const refuseRenewalAcrossReset = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const startedAt =
    ctx.request === undefined ? undefined : started.get(ctx.request);

  if (ctx.path !== "/oauth2/token" || startedAt === undefined) {
    return;
  }

  const issued = decodeIssued(ctx.context);

  if (Option.isNone(issued)) {
    return;
  }

  const subject = subjectOf(issued.value.returned.access_token);

  // A grant that named no resource gets an opaque access token, which no
  // route of Peal's takes and whose subject this hook cannot read: the
  // command line and MCP clients always name one. It is refused, its tokens
  // never handed out.
  if (Option.isNone(subject)) {
    throw new APIError("BAD_REQUEST", {
      error: "invalid_target",
      error_description: "name the resource the token is for",
    });
  }

  const notBefore = await tokensNotBefore(
    ctx.context.internalAdapter,
    subject.value
  );

  if (!Option.exists(notBefore, (instant) => instant >= startedAt - inFlight)) {
    return;
  }

  await markTokensNotBefore(ctx, subject.value);
  await forgetConnectedApplications(ctx, subject.value);

  throw new APIError("BAD_REQUEST", {
    error: "invalid_grant",
    error_description: "invalid refresh token",
  });
};

// The second step of a password sign-in: Better Auth's two-factor plugin
// keeps the challenge in `auth.verification` under the signed `two_factor`
// cookie's identifier, valued with the user's id.
const twoStepChallengeCookie = "two_factor";

/**
 * Part of Better Auth's before hook, on `/two-factor/verify-*` without a
 * session: a challenge the password step created before the account's
 * instant, or within the margin after it, began with a password a reset or
 * a release has since ended. It is deleted, and the step refused as an
 * unknown challenge is, so it never makes a session after the reset.
 */
export const refuseStaleTwoStepChallenge = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  if (!ctx.path?.startsWith("/two-factor/verify-")) {
    return;
  }

  const cookie = ctx.context.createAuthCookie(twoStepChallengeCookie);
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);

  if (
    identifier === null ||
    identifier === false ||
    identifier === "" ||
    // The database's session, never the cookie's five-minute copy, which
    // a reset that ended the session does not reach.
    (await getSessionFromCtx(ctx, {
      disableCookieCache: true,
      disableRefresh: true,
    })) !== null
  ) {
    return;
  }

  const challenge =
    await ctx.context.internalAdapter.findVerificationValue(identifier);

  if (challenge === null) {
    return;
  }

  const notBefore = await tokensNotBefore(
    ctx.context.internalAdapter,
    challenge.value
  );

  if (
    !Option.exists(
      notBefore,
      (instant) => challenge.createdAt.getTime() < instant + inFlight
    )
  ) {
    return;
  }

  await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);

  throw APIError.from("UNAUTHORIZED", {
    code: "INVALID_TWO_FACTOR_COOKIE",
    message: "Sign in again: this second step began before a password change",
  });
};
