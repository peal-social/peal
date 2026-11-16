import { describe, expect, it } from "@effect/vitest";

import {
  cameFromProvider,
  signInReturn,
  signUpReturn,
} from "#auth/provider-return.ts";

// As the pages write their paths, in French.
const localized = (href: string) => `/fr${href}`;

const invitation = "0b9f1c2e-4f2a-4d4b-9a51-3c1f6f0a2b7e";

describe(signUpReturn, () => {
  it("sends a new account to the app, and a refusal back to the page", () => {
    expect(signUpReturn(null, localized)).toStrictEqual({
      errorPath: "/fr/sign-up?from=provider",
      next: "/fr/app",
      signUp: { invitationId: null, newUserPath: "/fr/app" },
    });
  });

  // An account that existed signs in from the invitation's sign-up page:
  // it lands on the invitation, as a new one does.
  it("sends every account back to the invitation it came from", () => {
    expect(signUpReturn(invitation, localized)).toStrictEqual({
      errorPath: `/fr/sign-up?invitation=${invitation}&from=provider`,
      next: `/fr/invitations/${invitation}`,
      signUp: {
        invitationId: invitation,
        newUserPath: `/fr/invitations/${invitation}`,
      },
    });
  });
});

describe(signInReturn, () => {
  // The authorization server sends its own refusals to the sign-in page
  // too, without the mark: the page tells them from the provider's.
  it("marks a refusal as the provider's, and keeps where to go next", () => {
    expect(signInReturn("/device?code=ABCD", localized)).toStrictEqual({
      errorPath: "/fr/sign-in?next=%2Fdevice%3Fcode%3DABCD&from=provider",
      next: "/device?code=ABCD",
    });
  });
});

describe(cameFromProvider, () => {
  it.each([
    ["provider", true],
    [undefined, false],
    ["elsewhere", false],
    [["provider", "provider"], false],
  ] as const)("reads %j as %s", (from, expected) => {
    expect(cameFromProvider(from)).toBe(expected);
  });
});
