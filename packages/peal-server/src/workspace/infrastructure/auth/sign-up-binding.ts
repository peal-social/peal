// The row of `auth.verification` that binds an account's confirmation to
// the browser that signed up (sign-up-browser.ts): one per account, named
// after it, holding digests only.
const bindingPrefix = "sign-up-browser:";

/** The identifier of the account's binding in `auth.verification`. */
export const bindingOf = (userId: string): string =>
  `${bindingPrefix}${userId}`;
