import {
  getCurrentAdapter,
  runWithTransaction,
} from "@better-auth/core/context";
import type { GenericEndpointContext, User } from "better-auth";
import { getSessionFromCtx, sendVerificationEmailFn } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { Effect, Layer, Option, Schema } from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import {
  fittedName,
  maxPersonNameLength,
} from "#shared/domain/display-name.ts";
import { defaultLocale, LocaleSchema } from "#shared/domain/locale.ts";

import { forgetConnectedApplications } from "./connected-applications.ts";
import { bindingOf } from "./sign-up-binding.ts";
import { markTokensNotBefore } from "./tokens-not-before.ts";
import { forgetTrustedBrowsersOf } from "./two-step.ts";
import { UsedAccountError } from "./used-account-error.ts";

// A password's sign-up binds the account's confirmation to the browser that
// signed up: a random nonce in an HttpOnly cookie there, and its SHA-256 with
// the account, beside the SHA-256 of the password it was set with. Opening
// the emailed link proves the mailbox; holding the nonce proves the person
// confirming is the one who chose the password. Both, and the account is
// confirmed and signed in. The link alone confirms the address, drops the
// password and every session, and signs nobody in: whoever set the password
// may not be whoever owns the address.
//
// Every decision about an unconfirmed account starts with a statement that
// takes its row's lock and holds only while the address is unconfirmed
// (`claimUnconfirmed`, `confirmUnconfirmed`): a sign-up taking an account
// over and a confirmation of it never interleave, and nothing is written
// to an account once its address is confirmed.

/** The cookie that holds the nonce, under Better Auth's prefix. */
export const signUpBrowserCookie = "sign_up_browser";

/** How long a sign-up's browser can confirm it, in seconds. */
export const signUpBrowserLifetime = 7 * 24 * 60 * 60;

const crypto = Layer.mergeAll(
  SecureRandom.layerWebCrypto,
  Digest.layerWebCrypto
);

const encoder = new TextEncoder();

const newNonce = async (): Promise<string> =>
  await Effect.runPromise(
    Effect.gen(function* randomNonce() {
      const random = yield* SecureRandom.SecureRandom;

      return Base64Url.encode(yield* random.randomBytes(32));
    }).pipe(Effect.provide(crypto))
  );

const digestOf = async (text: string): Promise<string> =>
  await Effect.runPromise(
    Effect.gen(function* sha256Hex() {
      const digest = yield* Digest.Digest;

      return yield* digest.digestHex(Digest.sha256, encoder.encode(text));
    }).pipe(Effect.provide(crypto))
  );

const sameDigest = (left: string, right: string): boolean =>
  Mac.timingSafeEqual(encoder.encode(left), encoder.encode(right));

const BindingSchema = Schema.Struct({
  nonce: Schema.String,
  password: Schema.String,
});

const decodeBinding = Schema.decodeUnknownOption(
  Schema.fromJsonString(BindingSchema)
);

const encodeBinding = Schema.encodeSync(Schema.fromJsonString(BindingSchema));

/** The nonce's cookie, as Better Auth names and sets its own. */
export const signUpBrowserCookieOf = (ctx: GenericEndpointContext) =>
  ctx.context.createAuthCookie(signUpBrowserCookie, {
    maxAge: signUpBrowserLifetime,
  });

type AuthCtx = Pick<GenericEndpointContext, "context">;

// Takes the user's row lock, and writes `update` to it, only while its
// address is unconfirmed: whether it did.
const whileUnconfirmed = async (
  ctx: AuthCtx,
  userId: string,
  update: { readonly emailVerified?: true }
): Promise<boolean> => {
  const adapter = await getCurrentAdapter(ctx.context.adapter);

  const changed = await adapter.updateMany({
    model: "user",
    update: { ...update, updatedAt: new Date() },
    where: [
      { field: "id", value: userId },
      { field: "emailVerified", value: false },
    ],
  });

  return changed > 0;
};

/**
 * The first statement of a sign-up's takeover: holds the account's row
 * while its address is unconfirmed, and says whether it is. Once
 * confirmed, the takeover stops there.
 */
export const claimUnconfirmed = async (
  ctx: AuthCtx,
  userId: string
): Promise<boolean> => await whileUnconfirmed(ctx, userId, {});

/**
 * The first statement of a confirmation: confirms the address, holding the
 * account's row, while it is unconfirmed, and says whether it was. A
 * sign-up's takeover then waits for the confirmation's transaction and
 * finds the address confirmed.
 */
export const confirmUnconfirmed = async (
  ctx: AuthCtx,
  userId: string
): Promise<boolean> =>
  await whileUnconfirmed(ctx, userId, { emailVerified: true });

// Keeps, with the account, the digests of the nonce and of the password
// hash it goes with, replacing any earlier binding.
const bind = async (
  ctx: AuthCtx,
  userId: string,
  nonce: string,
  passwordHash: string
): Promise<void> => {
  const identifier = bindingOf(userId);

  await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);

  await ctx.context.internalAdapter.createVerificationValue({
    expiresAt: new Date(Date.now() + signUpBrowserLifetime * 1000),
    identifier,
    value: encodeBinding({
      nonce: await digestOf(nonce),
      password: await digestOf(passwordHash),
    }),
  });
};

// The name a released account goes by: its address's local part, made a
// name Peal keeps (`fittedName`), as nothing the pre-registrant typed may
// stay.
const releasedName = (email: string): string => {
  const local = email.slice(0, Math.max(0, email.lastIndexOf("@")));
  const name = fittedName(local, maxPersonNameLength);

  return name === "" ? fittedName(email, maxPersonNameLength) : name;
};

/**
 * Leaves an account as a provider's sign-up leaves one: no password, no
 * session, no connected application, no browser that may confirm it, and
 * nothing the pre-registrant chose (the name goes back to the address's,
 * the language to the default). What its password let in ends with it,
 * bearer tokens issued before now included (`markTokensNotBefore`). Run
 * inside the transaction that holds the row.
 */
export const releaseAccount = async (
  ctx: AuthCtx,
  user: { readonly email: string; readonly id: string }
): Promise<void> => {
  const { internalAdapter } = ctx.context;
  const credential = await internalAdapter.findCredentialAccount(user.id);

  if (credential !== null) {
    await internalAdapter.deleteAccount(credential.id);
  }

  await internalAdapter.updateUser(user.id, {
    locale: defaultLocale,
    name: releasedName(user.email),
  });
  await internalAdapter.deleteUserSessions(user.id);
  await markTokensNotBefore(ctx, user.id);
  await forgetConnectedApplications(ctx, user.id);
  await internalAdapter.deleteVerificationByIdentifier(bindingOf(user.id));
  await forgetTrustedBrowsersOf(
    await getCurrentAdapter(ctx.context.adapter),
    user.id
  );
};

/**
 * Whether the account was used before its address was confirmed: a member
 * of a workspace, as only a server that does not ask to confirm addresses
 * (or did not, when it was used) lets an unconfirmed account sign in. Such
 * an account is neither released by a link nor taken over by a sign-up nor
 * joined by a provider: its maker confirms it from their own session, the
 * address's owner may have it closed in so many words (`erase`), and a
 * password reset, which proves the address, hands it to the owner with the
 * keys and pending invitations of the workspaces it alone owns removed.
 */
export const wasUsed = async (
  ctx: AuthCtx,
  userId: string
): Promise<boolean> => {
  const adapter = await getCurrentAdapter(ctx.context.adapter);

  const memberships = await adapter.count({
    model: "member",
    where: [{ field: "userId", value: userId }],
  });

  return memberships > 0;
};

// What a sign-up's body holds, as the route validated it.
const decodeSignUp = Schema.decodeUnknownOption(
  Schema.Struct({
    email: Schema.String,
    locale: Schema.optional(Schema.Unknown),
    name: Schema.String,
    password: Schema.String,
  })
);

const decodeLocale = Schema.decodeUnknownOption(LocaleSchema);

// The id of the user the route answered with: the account it made, or the
// made-up one a known address gets. Anything else (a refusal of the route,
// or of the body's schema before it ran) answered no sign-up.
const decodeAnswered = Schema.decodeUnknownOption(
  Schema.Struct({
    returned: Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  })
);

// Whether a password is one the route takes: it checked, but the takeover
// checks again, never trusting what came before it.
const fitsBounds = (ctx: AuthCtx, password: string): boolean => {
  const { maxPasswordLength, minPasswordLength } = ctx.context.password.config;

  return (
    password.length >= minPasswordLength && password.length <= maxPasswordLength
  );
};

/**
 * A sign-up for an address that has an account: the new signer takes the
 * account over while its address is unconfirmed (their password and name,
 * a binding to their browser, a fresh link to the address; its sessions
 * and applications end, as whoever set the old password may hold some),
 * and changes nothing once it is confirmed. The password is hashed either
 * way, so a confirmed address takes as long. The transaction's first
 * statement holds the row while the address is unconfirmed
 * (`claimUnconfirmed`) and stops it otherwise: a confirmation running
 * meanwhile is either done first, or waits.
 */
export const takeOver = async (
  ctx: GenericEndpointContext,
  user: User,
  signUp: {
    readonly locale?: unknown;
    readonly name: string;
    readonly password: string;
  },
  nonce: string
): Promise<boolean> => {
  if (!fitsBounds(ctx, signUp.password)) {
    return false;
  }

  const { internalAdapter, password } = ctx.context;
  const hash = await password.hash(signUp.password);

  const updated = await runWithTransaction(ctx.context.adapter, async () => {
    // A confirmed address, or an account in use (on a server that once let
    // unconfirmed accounts in): nothing is taken over, the answer the same.
    if (
      !(await claimUnconfirmed(ctx, user.id)) ||
      (await wasUsed(ctx, user.id))
    ) {
      return null;
    }

    const credential = await internalAdapter.findCredentialAccount(user.id);

    await (credential === null
      ? internalAdapter.linkAccount({
          accountId: user.id,
          password: hash,
          providerId: "credential",
          userId: user.id,
        })
      : internalAdapter.updatePassword(user.id, hash));

    // The new signer's language, when the sign-up names one Peal speaks.
    const locale = decodeLocale(signUp.locale);

    const changed = await internalAdapter.updateUser(
      user.id,
      Option.isSome(locale)
        ? { locale: locale.value, name: signUp.name }
        : { name: signUp.name }
    );

    await internalAdapter.deleteUserSessions(user.id);
    await markTokensNotBefore(ctx, user.id);
    await forgetConnectedApplications(ctx, user.id);
    // A browser the old password's holder had trusted asks for a code
    // again.
    await forgetTrustedBrowsersOf(
      await getCurrentAdapter(ctx.context.adapter),
      user.id
    );
    await bind(ctx, user.id, nonce, hash);

    return changed;
  });

  if (updated === null) {
    return false;
  }

  // Once more, committed: a password sign-in that read the old password may
  // have written a session the transaction did not see.
  await internalAdapter.deleteUserSessions(user.id);
  await sendVerificationEmailFn(ctx, updated);

  return true;
};

/**
 * Part of Better Auth's after hook, on `/sign-up/email` that answered a
 * user: sets a fresh nonce in the browser's cookie, whatever the address,
 * so every answer reads alike, and binds it to the account where the
 * sign-up decides the account's password:
 *
 * - the request made the account: its nonce confirms it;
 * - the address has an account: `takeOver`, which changes it only while
 *   its address is unconfirmed.
 *
 * Any other answer (the route's refusal, or the body's schema refused
 * before the route ran) sets nothing.
 */
export const bindSignUpBrowser = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  if (ctx.path !== "/sign-up/email") {
    return;
  }

  const answered = decodeAnswered(ctx.context);
  const signUp = decodeSignUp(ctx.body);

  if (Option.isNone(answered) || Option.isNone(signUp)) {
    return;
  }

  const nonce = await newNonce();
  const cookie = signUpBrowserCookieOf(ctx);

  ctx.setCookie(cookie.name, nonce, cookie.attributes);

  const found = await ctx.context.internalAdapter.findUserByEmail(
    signUp.value.email.toLowerCase()
  );

  if (found === null) {
    return;
  }

  if (answered.value.returned.user.id === found.user.id) {
    // One more hash, thrown away, as `takeOver` hashes once more for an
    // address that has an account: every answered sign-up takes as long.
    await ctx.context.password.hash(signUp.value.password);

    const credential = await ctx.context.internalAdapter.findCredentialAccount(
      found.user.id
    );

    if (
      !found.user.emailVerified &&
      credential?.password !== undefined &&
      credential.password !== null
    ) {
      await bind(ctx, found.user.id, nonce, credential.password);
    }

    return;
  }

  await takeOver(ctx, found.user, signUp.value, nonce);
};

/**
 * Whether the request holds the nonce the account was bound to, and the
 * account still has the password the binding was made with, compared in
 * constant time. The binding is spent either way.
 */
export const holdsBinding = async (
  ctx: AuthCtx,
  userId: string,
  presented: string | null | undefined
): Promise<boolean> => {
  const binding = await ctx.context.internalAdapter.consumeVerificationValue(
    bindingOf(userId)
  );

  const credential =
    await ctx.context.internalAdapter.findCredentialAccount(userId);

  const stored = Option.fromNullishOr(binding).pipe(
    Option.flatMap(({ value }) => decodeBinding(value))
  );

  if (
    Option.isNone(stored) ||
    presented === undefined ||
    presented === null ||
    presented === "" ||
    credential?.password === undefined ||
    credential.password === null
  ) {
    return false;
  }

  const nonce = sameDigest(stored.value.nonce, await digestOf(presented));

  const passwordKept = sameDigest(
    stored.value.password,
    await digestOf(credential.password)
  );

  return nonce && passwordKept;
};

const isImpersonation = Schema.is(
  Schema.Struct({ impersonatedBy: Schema.NonEmptyString })
);

/**
 * Whether the request holds a live session of the account, read from the
 * database, never a cookie's cached copy, and not one staff act in: its
 * maker signed in with its password, as only a server that does not ask to
 * confirm addresses allows.
 */
export const holdsOwnSession = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<boolean> => {
  const token = await ctx.getSignedCookie(
    ctx.context.authCookies.sessionToken.name,
    ctx.context.secret
  );

  if (token === null || token === false || token === "") {
    return false;
  }

  const found = await ctx.context.internalAdapter.findSession(token);

  return (
    found !== null &&
    found.user.id === userId &&
    found.session.expiresAt.getTime() > Date.now() &&
    !isImpersonation(found.session)
  );
};

/**
 * Part of Better Auth's after hook, on `/send-verification-email` that went
 * through: a browser holding a live session of an unconfirmed account (its
 * maker, signed in) gets a fresh nonce bound to it, so a link sent again
 * after the first binding ran out still signs it in. Any other request
 * binds nothing.
 */
export const renewSignUpBrowser = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const email = decodeResend(ctx.body);

  if (
    ctx.path !== "/send-verification-email" ||
    Option.isNone(email) ||
    !isSent(ctx.context)
  ) {
    return;
  }

  const found = await ctx.context.internalAdapter.findUserByEmail(
    email.value.email.toLowerCase()
  );

  if (
    found === null ||
    found.user.emailVerified ||
    !(await holdsOwnSession(ctx, found.user.id))
  ) {
    return;
  }

  const credential = await ctx.context.internalAdapter.findCredentialAccount(
    found.user.id
  );

  if (credential?.password === undefined || credential.password === null) {
    return;
  }

  const nonce = await newNonce();
  const cookie = signUpBrowserCookieOf(ctx);

  ctx.setCookie(cookie.name, nonce, cookie.attributes);
  await bind(ctx, found.user.id, nonce, credential.password);
};

const decodeResend = Schema.decodeUnknownOption(
  Schema.Struct({ email: Schema.String })
);

// What the resend route answers once it sent, or pretended to.
const isSent = Schema.is(
  Schema.Struct({ returned: Schema.Struct({ status: Schema.Literal(true) }) })
);

/**
 * Signs the browser in as Better Auth's `autoSignInAfterVerification` did:
 * the browser's own session of the account, now confirmed, or a new one.
 */
export const signInConfirmed = async (
  ctx: GenericEndpointContext,
  user: User
): Promise<void> => {
  const current = await getSessionFromCtx(ctx);

  if (current !== null && current.user.id === user.id) {
    await setSessionCookie(ctx, {
      session: current.session,
      user: { ...current.user, emailVerified: true },
    });

    return;
  }

  const session = await ctx.context.internalAdapter.createSession(user.id);

  await setSessionCookie(ctx, {
    session,
    user: { ...user, emailVerified: true },
  });
};

/** What a provider's sign-in found of an unconfirmed account. */
export type ProviderTakeover = "none" | "released" | "used";

/**
 * Part of a provider's sign-in, once Peal's admission let it link an
 * existing account (`link-account`): an account that never confirmed its
 * address is confirmed and released in one transaction (`released`), as
 * the provider now vouches for the address and whoever set the password
 * may not own it; Better Auth then links the provider, finds the address
 * confirmed and signs in. An account that was used (`wasUsed`) is left
 * as it is (`used`), and the caller refuses the sign-in: the person signs
 * in with its password and confirms, or, from a confirmation link, has it
 * closed in so many words. A provider's sign-in never erases anything.
 */
export const releaseUnconfirmedAccount = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<ProviderTakeover> => {
  const found = await ctx.context.internalAdapter.findUserById(userId);

  if (found === null || found.emailVerified) {
    return "none";
  }

  try {
    const done = await runWithTransaction(ctx.context.adapter, async () => {
      if (!(await confirmUnconfirmed(ctx, userId))) {
        return "none";
      }

      if (await wasUsed(ctx, userId)) {
        throw new UsedAccountError();
      }

      await releaseAccount(ctx, found);

      return "released";
    });

    // Once more, committed: a password sign-in that read the old password
    // may have written a session the transaction did not see.
    if (done === "released") {
      await ctx.context.internalAdapter.deleteUserSessions(userId);
    }

    return done;
  } catch (error) {
    if (error instanceof UsedAccountError) {
      return "used";
    }

    throw error;
  }
};
