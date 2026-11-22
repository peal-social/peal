/**
 * Thrown inside a transaction about an unconfirmed account that turns out
 * to have been used (a member of a workspace) to roll it back: such an
 * account is closed, never handed over (sign-up-browser.ts).
 */
export class UsedAccountError extends Error {
  override readonly name = "UsedAccountError";
}
