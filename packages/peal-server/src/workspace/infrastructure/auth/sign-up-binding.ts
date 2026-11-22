// Rows of `auth.verification` Peal keeps about an account, named after it,
// which closing the account deletes by their identifier.

const bindingPrefix = "sign-up-browser:";

const tokensNotBeforePrefix = "tokens-not-before:";

/**
 * The account's binding of its confirmation to the browser that signed up
 * (sign-up-browser.ts): digests only.
 */
export const bindingOf = (userId: string): string =>
  `${bindingPrefix}${userId}`;

/**
 * The instant before which the account's bearer tokens no longer work
 * (tokens-not-before.ts): a password reset's or a release's.
 */
export const tokensNotBeforeOf = (userId: string): string =>
  `${tokensNotBeforePrefix}${userId}`;
