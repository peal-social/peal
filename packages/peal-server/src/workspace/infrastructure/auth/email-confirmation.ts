import { runWithTransaction } from "@better-auth/core/context";
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
} from "better-auth/api";
import { deleteSessionCookie, expireCookie } from "better-auth/cookies";
import { Option, Schema } from "effect";
import { jwtVerify } from "jose";
import { JWTExpired } from "jose/errors";

import {
  confirmUnconfirmed,
  holdsBinding,
  releaseAccount,
  signInConfirmed,
  signUpBrowserCookieOf,
  wasUsed,
} from "./sign-up-browser.ts";
import { UsedAccountError } from "./used-account-error.ts";

/**
 * The route the web app's confirmation page posts the emailed token to
 * (`/api/auth/confirm-email`). Better Auth's own `GET /verify-email` is
 * disabled: a mail gateway that opens every link would confirm the address
 * from no browser of the person's. A GET of the page confirms nothing.
 */
export const confirmationPath = "/confirm-email";

/**
 * What a confirmation did:
 *
 * - `signedIn`: confirmed, from the browser that signed up, now signed in;
 * - `passwordNeeded`: confirmed from another browser, the password the
 *   sign-up set removed, nobody signed in: the person sets one;
 * - `alreadyConfirmed`: the address was confirmed before, nothing changed;
 * - `replaced`: the account someone made with the address was used before
 *   it was confirmed, so it was closed: the person signs up afresh;
 * - `inUse`: such an account could not be closed (others depend on a
 *   workspace it owns, say): nothing changed, the operator can help.
 */
export const ConfirmationOutcomeSchema = Schema.Literals([
  "alreadyConfirmed",
  "inUse",
  "passwordNeeded",
  "replaced",
  "signedIn",
]);

export type ConfirmationOutcome = typeof ConfirmationOutcomeSchema.Type;

/**
 * Closes an unconfirmed account that was used, through the account's own
 * erasure, and says whether it did.
 */
export type UnclaimedAccountCloser = (userId: string) => Promise<boolean>;

// What Better Auth's confirmation tokens hold: the address, the account it
// was sent for, and for a change of address the new one, which Peal never
// asks for.
const decodeClaims = Schema.decodeUnknownOption(
  Schema.Struct({
    email: Schema.String,
    updateTo: Schema.optional(Schema.String),
    userId: Schema.optional(Schema.String),
  })
);

const refused = (code: "INVALID_TOKEN" | "TOKEN_EXPIRED") =>
  APIError.from("BAD_REQUEST", {
    code,
    message:
      code === "TOKEN_EXPIRED"
        ? "This confirmation link has expired"
        : "This confirmation link is not valid",
  });

// The token's claims, as Better Auth's own route checks them: its secret,
// HS256, unexpired.
const claimsOf = async (token: string, secret: string) => {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    return decodeClaims(payload);
  } catch (error) {
    if (error instanceof JWTExpired) {
      throw refused("TOKEN_EXPIRED");
    }

    return Option.none();
  }
};

const decodeBody = Schema.decodeUnknownOption(
  Schema.Struct({ token: Schema.String })
);

const confirm = async (
  ctx: GenericEndpointContext,
  closeUnclaimed: UnclaimedAccountCloser
): Promise<ConfirmationOutcome> => {
  const body = decodeBody(ctx.body);

  if (Option.isNone(body)) {
    throw refused("INVALID_TOKEN");
  }

  const claims = await claimsOf(body.value.token, ctx.context.secret);

  if (Option.isNone(claims) || claims.value.updateTo !== undefined) {
    throw refused("INVALID_TOKEN");
  }

  const found = await ctx.context.internalAdapter.findUserByEmail(
    claims.value.email.toLowerCase()
  );

  if (
    found === null ||
    (claims.value.userId !== undefined && claims.value.userId !== found.user.id)
  ) {
    throw refused("INVALID_TOKEN");
  }

  const { user } = found;

  if (user.emailVerified) {
    return "alreadyConfirmed";
  }

  const cookie = signUpBrowserCookieOf(ctx);
  const presented = ctx.getCookie(cookie.name);
  const current = await getSessionFromCtx(ctx, { disableRefresh: true });

  if (presented !== null) {
    expireCookie(ctx, cookie);
  }

  let outcome: ConfirmationOutcome;

  try {
    // Its first statement confirms the address and holds the row, so a
    // sign-up taking the account over meanwhile waits, then finds it
    // confirmed and changes nothing.
    outcome = await runWithTransaction(ctx.context.adapter, async () => {
      if (!(await confirmUnconfirmed(ctx, user.id))) {
        return "alreadyConfirmed";
      }

      if (await holdsBinding(ctx, user.id, presented)) {
        return "signedIn";
      }

      if (await wasUsed(ctx, user.id)) {
        throw new UsedAccountError();
      }

      await releaseAccount(ctx, user);

      return "passwordNeeded";
    });
  } catch (error) {
    if (!(error instanceof UsedAccountError)) {
      throw error;
    }

    outcome = (await closeUnclaimed(user.id)) ? "replaced" : "inUse";
  }

  if (outcome === "signedIn") {
    await signInConfirmed(ctx, { ...user, emailVerified: true });
  } else if (current !== null && current.user.id === user.id) {
    deleteSessionCookie(ctx);
  }

  return outcome;
};

/**
 * The route that confirms an address, as a plugin of Better Auth's: the
 * web app's page posts the emailed token, from the browser that opened it
 * (sign-up-browser.ts says what each browser gets).
 */
export const emailConfirmation = (closeUnclaimed: UnclaimedAccountCloser) =>
  ({
    endpoints: {
      confirmEmail: createAuthEndpoint(
        confirmationPath,
        {
          body: Schema.toStandardSchemaV1(
            Schema.Struct({ token: Schema.String })
          ),
          method: "POST",
        },
        async (ctx) =>
          await ctx.json({ status: await confirm(ctx, closeUnclaimed) })
      ),
    },
    id: "peal-email-confirmation",
  }) satisfies BetterAuthPlugin;
