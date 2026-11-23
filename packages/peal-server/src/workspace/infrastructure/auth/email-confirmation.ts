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
  holdsOwnSession,
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
 * Why the page posts:
 *
 * - `auto`: it posts on its own as it opens. It confirms only from proof
 *   that the browser is the account's maker's (the sign-up's nonce, or a
 *   live session of the account), and otherwise changes nothing.
 * - `confirm`: the person pressed the button, once the page said what it
 *   does. An account never used is confirmed and released; a used one is
 *   left as it is.
 * - `erase`: the person said the account is not theirs, in so many words,
 *   and confirmed it. Only this closes a used account.
 */
export const ConfirmationIntentSchema = Schema.Literals([
  "auto",
  "confirm",
  "erase",
]);

export type ConfirmationIntent = typeof ConfirmationIntentSchema.Type;

/**
 * What a confirmation did:
 *
 * - `signedIn`: confirmed, from the maker's browser, now signed in;
 * - `choose`: nothing changed, as the post came on its own from a browser
 *   that is not the maker's: the page explains, and asks;
 * - `passwordNeeded`: confirmed on the person's word, the account never
 *   used: the password the sign-up set removed, nobody signed in, the
 *   person sets one;
 * - `inUse`: nothing changed, as the account was used before its address
 *   was confirmed: its maker signs in on this browser and opens the link
 *   again, or the address's owner has it closed (`erase`);
 * - `replaced`: closed on the address's owner's word: they sign up afresh;
 * - `notErased`: it could not be closed (confirmed meanwhile, or others
 *   depend on a workspace it alone owns): nothing changed;
 * - `alreadyConfirmed`: the address was confirmed before, nothing changed.
 */
export const ConfirmationOutcomeSchema = Schema.Literals([
  "alreadyConfirmed",
  "choose",
  "inUse",
  "notErased",
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

const BodySchema = Schema.Struct({
  intent: Schema.optional(ConfirmationIntentSchema),
  token: Schema.String,
});

const decodeBody = Schema.decodeUnknownOption(BodySchema);

// What the transaction decided, for the outcomes that change nothing: it
// rolls back, the binding it spent included.
type Decided = ConfirmationOutcome | "erase";

// The account the posted token names, with why the page posted: refused
// unless the token is Better Auth's own for that account.
const requested = async (ctx: GenericEndpointContext) => {
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

  return { intent: body.value.intent ?? "auto", user: found.user };
};

const confirm = async (
  ctx: GenericEndpointContext,
  closeUnclaimed: UnclaimedAccountCloser
): Promise<ConfirmationOutcome> => {
  const { intent, user } = await requested(ctx);

  if (user.emailVerified) {
    return "alreadyConfirmed";
  }

  const cookie = signUpBrowserCookieOf(ctx);
  const presented = ctx.getCookie(cookie.name);
  const current = await getSessionFromCtx(ctx, { disableRefresh: true });
  const ownSession = await holdsOwnSession(ctx, user.id);

  let unchanged: Decided = "choose";
  let decided: Decided;

  try {
    decided = await runWithTransaction(
      ctx.context.adapter,
      async (): Promise<Decided> => {
        // Its first statement confirms the address and holds the row, so a
        // sign-up taking the account over, or an erasure, meanwhile waits,
        // then finds it confirmed and changes nothing.
        if (!(await confirmUnconfirmed(ctx, user.id))) {
          return "alreadyConfirmed";
        }

        // The maker's browser: the nonce of its sign-up, or its own session.
        if ((await holdsBinding(ctx, user.id, presented)) || ownSession) {
          return "signedIn";
        }

        const used = await wasUsed(ctx, user.id);

        if (intent === "auto") {
          unchanged = "choose";
        } else if (used) {
          unchanged = intent === "erase" ? "erase" : "inUse";
        } else {
          await releaseAccount(ctx, user);

          return "passwordNeeded";
        }

        throw new UsedAccountError();
      }
    );
  } catch (error) {
    if (!(error instanceof UsedAccountError)) {
      throw error;
    }

    decided = unchanged;
  }

  let outcome: ConfirmationOutcome;

  if (decided === "erase") {
    outcome = (await closeUnclaimed(user.id)) ? "replaced" : "notErased";
  } else {
    outcome = decided;
  }

  if (
    (outcome === "signedIn" || outcome === "passwordNeeded") &&
    presented !== null
  ) {
    expireCookie(ctx, cookie);
  }

  if (outcome === "signedIn") {
    await signInConfirmed(ctx, { ...user, emailVerified: true });
  } else if (
    (outcome === "passwordNeeded" || outcome === "replaced") &&
    current !== null &&
    current.user.id === user.id
  ) {
    deleteSessionCookie(ctx);
  }

  return outcome;
};

/**
 * The route that confirms an address, as a plugin of Better Auth's: the
 * web app's page posts the emailed token, from the browser that opened it,
 * with why it posts (`ConfirmationIntentSchema`).
 */
export const emailConfirmation = (closeUnclaimed: UnclaimedAccountCloser) =>
  ({
    endpoints: {
      confirmEmail: createAuthEndpoint(
        confirmationPath,
        {
          body: Schema.toStandardSchemaV1(BodySchema),
          method: "POST",
        },
        async (ctx) =>
          await ctx.json({ status: await confirm(ctx, closeUnclaimed) })
      ),
    },
    id: "peal-email-confirmation",
  }) satisfies BetterAuthPlugin;
