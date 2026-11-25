import type { AuthClientError } from "#auth/errors.ts";
import { settingsErrorKey } from "#settings/errors.ts";
import type { SettingsErrorKey } from "#settings/errors.ts";

// Signing out every session of the person's but this one, from the
// Security page: the list's last row, and the row beside **Sign in
// again** for a session too old to read the list. Better Auth's
// `/revoke-other-sessions` asks for a session, not a fresh one, and
// keeps this one: the person stays signed in here, and this browser's
// other tabs, which share this session, are told nothing.

/** What signing out the other sessions does in the browser, step by step. */
export interface RevokeOthersSteps {
  /** Says why Better Auth refused: the page stays as it is. */
  readonly refused: (reason: SettingsErrorKey) => void;
  /** Asks Better Auth to sign out every other session. */
  readonly revoke: () => Promise<{ readonly error: AuthClientError | null }>;
  /** Says the other sessions are signed out, and reads the list again. */
  readonly signedOut: () => void;
}

// Better Auth's answer, or the failure of a request that never got one.
const answered = async (
  steps: RevokeOthersSteps
): Promise<AuthClientError | null> => {
  try {
    const { error } = await steps.revoke();

    return error;
  } catch {
    // The server could not be reached: nothing is known to have changed.
    return { status: 0 };
  }
};

/** Signs out every other session: whether Better Auth did. */
export const signOutOtherSessions = async (
  steps: RevokeOthersSteps
): Promise<boolean> => {
  const error = await answered(steps);

  if (error === null) {
    steps.signedOut();

    return true;
  }

  steps.refused(settingsErrorKey(error));

  return false;
};
