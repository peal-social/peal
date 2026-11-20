import { Schema } from "effect";
import { LastSignInSchema } from "peal-contract";
import type { LastSignIn, SignInProvider } from "peal-contract";

const isLastSignIn = Schema.is(LastSignInSchema);

/**
 * How this browser last signed in, as the server's cookie says, or null
 * when it says nothing this page can offer.
 */
export const lastSignInOf = (value: string | undefined): LastSignIn | null =>
  isLastSignIn(value) ? value : null;

/** A way to sign in a page offers: a provider, or the email form. */
export type SignInMethod = LastSignIn;

/**
 * The ways a page offers, in order: the one this browser used last
 * first, then the providers in the server's order, then email. The first
 * is the page's main action.
 */
export const methodsOf = (
  providers: readonly SignInProvider[],
  last: LastSignIn | null
): readonly SignInMethod[] => {
  const offered: readonly SignInMethod[] = [
    ...providers.map(({ id }) => id),
    "email",
  ];

  return last !== null && offered.includes(last)
    ? [last, ...offered.filter((method) => method !== last)]
    : offered;
};
