import { Option } from "effect";

/** What Better Auth answers a sign-up with the password. */
export interface SignUpAnswer {
  /** The new session's, where the sign-up signed the browser in. */
  readonly token: string | null;
  readonly user: { readonly id: string };
}

/**
 * Who a sign-up signed in at once: only on a server that asks for no
 * confirmation first (`AUTH_REQUIRE_EMAIL_VERIFICATION=false`), whose
 * answer then carries the new session's token. Elsewhere the emailed
 * link signs the account in, and nobody is signed in yet.
 */
export const signedInAtSignUp = (answer: SignUpAnswer): Option.Option<string> =>
  answer.token === null ? Option.none() : Option.some(answer.user.id);
