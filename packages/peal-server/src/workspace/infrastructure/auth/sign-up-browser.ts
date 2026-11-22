import {
  getCurrentAuthEndpointContext,
  runWithTransaction,
} from "@better-auth/core/context";
import type { GenericEndpointContext, User } from "better-auth";
import {
  APIError,
  getSessionFromCtx,
  sendVerificationEmailFn,
} from "better-auth/api";
import {
  deleteSessionCookie,
  expireCookie,
  parseCookies,
  setSessionCookie,
} from "better-auth/cookies";
import { Effect, Layer, Option, Schema } from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

import { LocaleSchema } from "#shared/domain/locale.ts";

import { forgetConnectedApplications } from "./connected-applications.ts";
import { bindingOf } from "./sign-up-binding.ts";

// A password's sign-up binds the account's confirmation to the browser that
// signed up: a random nonce in an HttpOnly cookie there, and its SHA-256 with
// the account, beside the SHA-256 of the password it was set with. Opening
// the emailed link proves the mailbox; holding the nonce proves the person
// opening it is the one who chose the password. Both, and the account is
// confirmed and signed in. The link alone confirms the address, drops the
// password and every session, and signs nobody in: whoever set the password
// may not be whoever owns the address.

/** The cookie that holds the nonce, under Better Auth's prefix. */
export const signUpBrowserCookie = "sign_up_browser";

/** How long a sign-up's browser can confirm it, in seconds. */
export const signUpBrowserLifetime = 7 * 24 * 60 * 60;

/** The mark the confirmation page reads: the address is confirmed, sign in by setting a password. */
export const passwordNeededMark = {
  name: "password",
  value: "needed",
} as const;

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

const cookieOf = (ctx: GenericEndpointContext) =>
  ctx.context.createAuthCookie(signUpBrowserCookie, {
    maxAge: signUpBrowserLifetime,
  });

// Keeps, with the account, the digests of the nonce and of the password
// hash it goes with, replacing any earlier binding.
const bind = async (
  ctx: GenericEndpointContext,
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

/**
 * Leaves an unconfirmed account as a provider's sign-up leaves one: no
 * password, no session, no connected application, no browser that may
 * confirm it. What its password let in ends with it.
 */
export const releaseAccount = async (
  ctx: Pick<GenericEndpointContext, "context">,
  userId: string
): Promise<void> => {
  const { internalAdapter } = ctx.context;

  await runWithTransaction(ctx.context.adapter, async () => {
    const credential = await internalAdapter.findCredentialAccount(userId);

    if (credential !== null) {
      await internalAdapter.deleteAccount(credential.id);
    }

    await internalAdapter.deleteUserSessions(userId);
    await forgetConnectedApplications(ctx, userId);
    await internalAdapter.deleteVerificationByIdentifier(bindingOf(userId));
  });
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
// made-up one a known address gets.
const decodeAnswered = Schema.decodeUnknownOption(
  Schema.Struct({
    returned: Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  })
);

const isRefusal = Schema.is(
  Schema.Struct({ returned: Schema.instanceOf(APIError) })
);

// The new signer of an address whose account waits for its confirmation
// takes the account over: their password and name, a binding to their
// browser, and a fresh link to the address. The account's sessions and
// applications end, as whoever set the old password may hold some.
const takeOver = async (
  ctx: GenericEndpointContext,
  user: User,
  signUp: {
    readonly locale?: unknown;
    readonly name: string;
    readonly password: string;
  },
  nonce: string
): Promise<void> => {
  const { internalAdapter, password } = ctx.context;
  const hash = await password.hash(signUp.password);

  const updated = await runWithTransaction(ctx.context.adapter, async () => {
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
    await forgetConnectedApplications(ctx, user.id);
    await bind(ctx, user.id, nonce, hash);

    return changed;
  });

  await sendVerificationEmailFn(ctx, updated);
};

/**
 * Part of Better Auth's after hook, on `/sign-up/email` that went through:
 * sets a fresh nonce in the browser's cookie, whatever the address, so every
 * answer reads alike, and binds it to the account where the sign-up decides
 * the account's password:
 *
 * - the request made the account: its nonce confirms it;
 * - the address has an account that never confirmed it: the new signer
 *   takes it over (`takeOver`), and is sent a new link;
 * - the address is confirmed: nothing changes, and the nonce binds nothing.
 *
 * A route that refused the sign-up sets nothing.
 */
export const bindSignUpBrowser = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  if (ctx.path !== "/sign-up/email" || isRefusal(ctx.context)) {
    return;
  }

  const signUp = decodeSignUp(ctx.body);

  if (Option.isNone(signUp)) {
    return;
  }

  const nonce = await newNonce();
  const cookie = cookieOf(ctx);

  ctx.setCookie(cookie.name, nonce, cookie.attributes);

  const found = await ctx.context.internalAdapter.findUserByEmail(
    signUp.value.email.toLowerCase()
  );

  if (found === null || found.user.emailVerified) {
    return;
  }

  const answered = decodeAnswered(ctx.context);

  if (
    Option.isSome(answered) &&
    answered.value.returned.user.id === found.user.id
  ) {
    const credential = await ctx.context.internalAdapter.findCredentialAccount(
      found.user.id
    );

    if (credential?.password !== undefined && credential.password !== null) {
      await bind(ctx, found.user.id, nonce, credential.password);
    }

    return;
  }

  await takeOver(ctx, found.user, signUp.value, nonce);
};

// Whether the request holds the nonce the account was bound to, and the
// account still has the password the binding was made with. The binding is
// spent either way.
const holdsBinding = async (
  ctx: Pick<GenericEndpointContext, "context">,
  userId: string,
  presented: string | undefined
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

// As Better Auth's `autoSignInAfterVerification` signs in: the browser's own
// session of the account, now confirmed, or a new one.
const signIn = async (
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

// The confirmation page's address with the mark, as the web app gave it
// (a path of its origin, or a full address).
const marked = (callbackURL: string, baseURL: string): string => {
  const url = new URL(callbackURL, baseURL);

  url.searchParams.set(passwordNeededMark.name, passwordNeededMark.value);

  return callbackURL.startsWith("/")
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
};

const decodeCallback = Schema.decodeUnknownOption(
  Schema.Struct({ callbackURL: Schema.String })
);

// What the link's confirmation decided, by request, for the route's after
// hook: Better Auth hands the verification's callback and the after hook
// the same request.
const confirmed = new WeakMap<
  Request,
  { readonly signIn: boolean; readonly user: User }
>();

/**
 * Better Auth's `emailVerification.beforeEmailVerification`: runs once the
 * link's token is checked, before the address is confirmed (Peal changes
 * no address, so it runs for nothing else). Better Auth's own sign-in after
 * the link is off.
 *
 * - The request holds the account's nonce, and the account still has the
 *   password it was bound with: the after hook signs it in.
 * - Otherwise the password, the sessions and the connected applications go
 *   (`releaseAccount`) before the address is confirmed, so a failure
 *   confirms nothing, and nobody is signed in.
 *
 * The binding is spent either way.
 */
export const checkSignUpBrowser = async (
  user: User,
  request?: Request
): Promise<void> => {
  const ctx = getCurrentAuthEndpointContext();

  const presented =
    request === undefined
      ? undefined
      : parseCookies(request.headers.get("cookie") ?? "").get(
          ctx.context.createAuthCookie(signUpBrowserCookie).name
        );

  const holds = await holdsBinding(ctx, user.id, presented);

  if (!holds) {
    await releaseAccount(ctx, user.id);
  }

  if (request !== undefined) {
    confirmed.set(request, { signIn: holds, user });
  }
};

/**
 * Part of Better Auth's after hook, on `/verify-email` once the link
 * confirmed the address (`checkSignUpBrowser` decided): expires the nonce's
 * cookie, then signs the browser that signed up in, as the link did
 * before; any other browser is signed in by nothing, loses its session of
 * the account if it held one, and is sent to the confirmation page marked
 * `?password=needed`, which asks for a password through the reset flow.
 */
export const confirmSignUpBrowser = async (
  ctx: GenericEndpointContext
): Promise<void> => {
  const decided =
    ctx.path === "/verify-email" && ctx.request !== undefined
      ? confirmed.get(ctx.request)
      : undefined;

  if (decided === undefined) {
    return;
  }

  const cookie = cookieOf(ctx);

  if (ctx.getCookie(cookie.name) !== null) {
    expireCookie(ctx, cookie);
  }

  if (decided.signIn) {
    await signIn(ctx, decided.user);

    return;
  }

  const current = await getSessionFromCtx(ctx, { disableRefresh: true });

  if (current !== null && current.user.id === decided.user.id) {
    deleteSessionCookie(ctx);
  }

  const callback = decodeCallback(ctx.query);

  if (Option.isSome(callback)) {
    throw ctx.redirect(marked(callback.value.callbackURL, ctx.context.baseURL));
  }
};

/**
 * Part of a provider's sign-in, once Peal's admission let it link an
 * existing account (`link-account`): an account that never confirmed its
 * address is released first (`releaseAccount`), as the provider now
 * vouches for the address and whoever set the password may not own it.
 * Better Auth then links the provider, confirms the address and signs in.
 */
export const releaseUnconfirmedAccount = async (
  ctx: GenericEndpointContext,
  userId: string
): Promise<void> => {
  const found = await ctx.context.internalAdapter.findUserById(userId);

  if (found !== null && !found.emailVerified) {
    await releaseAccount(ctx, userId);
  }
};
