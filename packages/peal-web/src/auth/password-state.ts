/**
 * Whether the account must set a password before the account page offers
 * what needs one (changing it, two-step verification, closing the
 * account): only when the server says it has none, as for an account a
 * sign-in provider made. An older server says nothing, and the page stays
 * as it was.
 */
export const needsPassword = (user: {
  readonly hasPassword?: boolean | undefined;
}): boolean => user.hasPassword === false;
