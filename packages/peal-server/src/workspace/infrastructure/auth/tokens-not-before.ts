import { getCurrentAuthEndpointContext } from "@better-auth/core/context";
import type { GenericEndpointContext, User } from "better-auth";
import { APIError } from "better-auth/api";
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

const decodeRenewal = Schema.decodeUnknownOption(
  Schema.Struct({ grant_type: Schema.Literal("refresh_token") })
);

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
 * Part of Better Auth's after hook, on `/oauth2/token`: a renewal that
 * started before the account's instant, or just after it while the
 * deletion ran, and still issued tokens, wrote them after they were
 * deleted. Its tokens go too, the instant moves to now so its access token
 * is refused, and the client is answered `invalid_grant`.
 */
export const refuseRenewalAcrossReset = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const startedAt =
    ctx.request === undefined ? undefined : started.get(ctx.request);

  if (
    ctx.path !== "/oauth2/token" ||
    startedAt === undefined ||
    Option.isNone(decodeRenewal(ctx.body))
  ) {
    return;
  }

  const subject = Option.flatMap(decodeIssued(ctx.context), ({ returned }) =>
    subjectOf(returned.access_token)
  );

  if (Option.isNone(subject)) {
    return;
  }

  const notBefore = await tokensNotBefore(
    ctx.context.internalAdapter,
    subject.value
  );

  if (!Option.exists(notBefore, (instant) => startedAt < instant + inFlight)) {
    return;
  }

  await markTokensNotBefore(ctx, subject.value);
  await forgetConnectedApplications(ctx, subject.value);

  throw new APIError("BAD_REQUEST", {
    error: "invalid_grant",
    error_description: "invalid refresh token",
  });
};
