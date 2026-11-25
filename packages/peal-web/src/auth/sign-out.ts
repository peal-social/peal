import type { SignedOutNotice } from "#auth/signed-out-notice.ts";

// Signing out, in the order every way out of the app takes it. The tab
// then loads the next page anew rather than moving to it in place: the
// browser drops the atom registry (the agent's chats and drafts, which
// live as long as the tab) and every module's state with the page, so
// the next person who signs in in the same tab starts with nothing of
// the last one's. The browser's other tabs of the app are told, and load
// the app anew as well. `useSignOut` (`#auth/use-sign-out.ts`) gives the
// browser's own steps.

/** What signing out does in the browser, step by step. */
export interface SignOutSteps {
  /** Asks Better Auth to end the session: whether it did. */
  readonly endSession: () => Promise<boolean>;
  /** Forgets the support chat's conversation in this browser. */
  readonly forgetConversation: () => void;
  /** Forgets the measured person, which tells the other tabs too. */
  readonly forgetMeasurement: () => void;
  /** Keeps what the next page says, across its load. */
  readonly keepNotice: (notice: SignedOutNotice) => void;
  /** Loads the address anew, dropping the page and all it holds. */
  readonly load: (address: string) => void;
  /**
   * Tells the browser's other tabs of the app, which load the app anew
   * too (`#auth/session-news.ts`).
   */
  readonly tellOtherTabs: () => void;
}

/** Where one way out goes, and what it does when the server refuses. */
export interface SignOutRequest {
  /** What the next page says once loaded (a toast), if anything. */
  readonly notice?: SignedOutNotice;
  /**
   * Tells the person a sign-out failed: they stay where they are,
   * still signed in.
   */
  readonly refused?: () => void;
  /**
   * The session went already, with the account: signing out only
   * clears its cookies, and the tab leaves whatever the server answers.
   */
  readonly sessionGone?: boolean;
  /** The address the next page loads at, its locale's prefix included. */
  readonly to: string;
}

const ended = async (steps: SignOutSteps): Promise<boolean> => {
  try {
    return await steps.endSession();
  } catch {
    // The server could not be reached: the session may well live on.
    return false;
  }
};

/**
 * Signs out, forgets the person (measurement, then the support chat),
 * tells the other tabs, then loads the next page: whether the tab is
 * leaving. A refused
 * sign-out forgets nothing and loads nothing, unless the session went
 * with the account.
 */
export const signOutAndLoad = async (
  steps: SignOutSteps,
  request: SignOutRequest
): Promise<boolean> => {
  if (!(await ended(steps)) && request.sessionGone !== true) {
    request.refused?.();

    return false;
  }

  // Before leaving, so nothing more is measured as the person.
  steps.forgetMeasurement();
  steps.forgetConversation();
  steps.tellOtherTabs();

  if (request.notice !== undefined) {
    steps.keepNotice(request.notice);
  }

  steps.load(request.to);

  return true;
};
