import type { SetActiveAnswer } from "#auth/choose-workspace.ts";
import type { ConsentAnswer } from "#auth/consent-scopes.ts";
import { isOAuthRedirect } from "#auth/oauth-redirect.ts";

/** What Better Auth's consent endpoint answers: a redirect, or an error. */
export interface ConsentReply {
  readonly data: unknown;
  readonly error: unknown;
}

/**
 * Makes the consent page's answer. Better Auth binds the client's tokens to
 * the session's active workspace at the moment the consent is posted, and
 * any tab of the same browser may have moved it since the page showed its
 * name: allowing sets the workspace the page shows as the active one again
 * first, and does not allow when that is refused, so the tokens are bound
 * to the workspace the person read. Denying binds nothing, and goes
 * straight on. Resolves to whether the answer went through.
 */
export const makeAnswerConsent =
  ({
    consent,
    setActive,
  }: {
    readonly consent: (
      answer: ConsentAnswer | { readonly accept: false }
    ) => Promise<ConsentReply>;
    readonly setActive: (organizationId: string) => Promise<SetActiveAnswer>;
  }) =>
  async (
    answer: ConsentAnswer | { readonly accept: false },
    shown: string | undefined
  ): Promise<boolean> => {
    if (answer.accept && shown !== undefined) {
      const kept = await setActive(shown)
        .then(({ error }) => error === null)
        .catch(() => false);

      if (!kept) {
        return false;
      }
    }

    const answered = await consent(answer).catch((): ConsentReply => ({
      data: null,
      error: true,
    }));

    return answered.error === null && isOAuthRedirect(answered.data);
  };
