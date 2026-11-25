import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { signUpLanding } from "#auth/provider-return.ts";
import { signedInAtSignUp } from "#auth/sign-up-answer.ts";

describe("a sign-up's answer", () => {
  it("signs nobody in where the emailed link confirms the account", () => {
    expect(
      signedInAtSignUp({ token: null, user: { id: "user_synthetic_ada" } })
    ).toStrictEqual(Option.none());
  });

  it("names the new person where the server signed the browser in", () => {
    expect(
      signedInAtSignUp({
        token: "session_synthetic_token",
        user: { id: "user_synthetic_ada" },
      })
    ).toStrictEqual(Option.some("user_synthetic_ada"));
  });

  it("goes on to the app, or to the invitation it came from", () => {
    expect(signUpLanding(null)).toBe("/");
    expect(signUpLanding("invitation_synthetic")).toBe(
      "/invitations/invitation_synthetic"
    );
  });
});
