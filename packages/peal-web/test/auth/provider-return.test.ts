import { describe, expect, it } from "@effect/vitest";

import { signUpReturn } from "#auth/provider-return.ts";

// As the pages write their paths, in French.
const localized = (href: string) => `/fr${href}`;

const invitation = "0b9f1c2e-4f2a-4d4b-9a51-3c1f6f0a2b7e";

describe(signUpReturn, () => {
  it("sends a new account to the app, and a refusal back to the page", () => {
    expect(signUpReturn(null, localized)).toStrictEqual({
      errorPath: "/fr/sign-up",
      next: "/fr/app",
      signUp: { invitationId: null, newUserPath: "/fr/app" },
    });
  });

  // An account that existed signs in from the invitation's sign-up page:
  // it lands on the invitation, as a new one does.
  it("sends every account back to the invitation it came from", () => {
    expect(signUpReturn(invitation, localized)).toStrictEqual({
      errorPath: `/fr/sign-up?invitation=${invitation}`,
      next: `/fr/invitations/${invitation}`,
      signUp: {
        invitationId: invitation,
        newUserPath: `/fr/invitations/${invitation}`,
      },
    });
  });
});
