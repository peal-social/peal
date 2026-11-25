import { Option, Schema } from "effect";

/**
 * The mark a provider's sign-in puts in the address its refusals come back
 * to (`from=provider`): the authorization server sends its own refusals of
 * an application to the sign-in page as well, unmarked, with some of the
 * same codes (`server_error`, `login_required`…), and the page explains
 * each as what it is. Anyone can write the address; the mark only picks a
 * message.
 */
const providerMark = ["from", "provider"] as const;

const decodeMark = Schema.decodeUnknownOption(Schema.Literal(providerMark[1]));

/** Whether a page's `from` parameter is a provider's mark. */
export const cameFromProvider = (
  from: string | readonly string[] | undefined
): boolean => Option.isSome(decodeMark(from));

const marked = (path: string, query: Readonly<Record<string, string>>) =>
  `${path}?${new URLSearchParams({ ...query, [providerMark[0]]: providerMark[1] }).toString()}`;

/**
 * Where a provider's sign-in sends the browser back to, as paths of this
 * origin, which the server checks against its trusted origins: once signed
 * in (`next`), after a refusal (the page itself, which explains the
 * `?error=`), and, from the sign-up page, once a new account is made.
 */
export interface ProviderReturn {
  readonly errorPath: string;
  readonly next: string;
  /** Where the page makes accounts: always on the sign-up page. */
  readonly signUp?: {
    readonly invitationId: string | null;
    readonly newUserPath: string;
  };
}

/**
 * Where an account made on the sign-up page goes once signed in: on to the
 * invitation it came from, otherwise to the app.
 */
export const signUpLanding = (invitationId: string | null): string =>
  invitationId === null ? "/" : `/invitations/${invitationId}`;

/**
 * The sign-up page's: from an invitation, every account, new or not, goes
 * on to the invitation it came from; otherwise to the app.
 */
export const signUpReturn = (
  invitationId: string | null,
  localized: (href: string) => string
): ProviderReturn => {
  const landing = signUpLanding(invitationId);

  return {
    errorPath: localized(
      marked(
        "/signup",
        invitationId === null ? {} : { invitation: invitationId }
      )
    ),
    next: localized(landing),
    signUp: { invitationId, newUserPath: localized(landing) },
  };
};

/**
 * The sign-in page's: back to the page, marked, once signed in as after a
 * refusal (which brings an `?error=`), as only then does the account's
 * language show. Signed in, the page sends on to `next` where the
 * password's sign-in goes, in the same language (`landingAddressOf`).
 * Where anyone may sign up, an address with no account gets one there
 * too, and comes back the same way.
 */
export const signInReturn = (
  next: string,
  localized: (href: string) => string,
  signUpOffered: boolean
): ProviderReturn => {
  const back = localized(marked("/login", { next }));

  if (!signUpOffered) {
    return { errorPath: back, next: back };
  }

  return {
    errorPath: back,
    next: back,
    signUp: { invitationId: null, newUserPath: back },
  };
};
