/**
 * Where a provider's sign-in sends the browser back to, as paths of this
 * origin, which the server checks against its trusted origins: once signed
 * in (`next`), after a refusal (the page itself, which explains the
 * `?error=`), and, from the sign-up page, once a new account is made.
 */
export interface ProviderReturn {
  readonly errorPath: string;
  readonly next: string;
  /** Only on the sign-up page, which alone makes accounts. */
  readonly signUp?: {
    readonly invitationId: string | null;
    readonly newUserPath: string;
  };
}

/**
 * The sign-up page's: from an invitation, every account, new or not, goes
 * on to the invitation it came from; otherwise to the app.
 */
export const signUpReturn = (
  invitationId: string | null,
  localized: (href: string) => string
): ProviderReturn => {
  const landing =
    invitationId === null ? "/app" : `/invitations/${invitationId}`;

  return {
    errorPath: localized(
      invitationId === null
        ? "/sign-up"
        : `/sign-up?${new URLSearchParams({ invitation: invitationId }).toString()}`
    ),
    next: localized(landing),
    signUp: { invitationId, newUserPath: localized(landing) },
  };
};
