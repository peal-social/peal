import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { authErrorKey, providerErrorKey } from "#auth/errors.ts";

describe(authErrorKey, () => {
  it("explains the errors Better Auth reports by code", () => {
    expect(
      authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })
    ).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it.each(["MEMBER_LIMIT_REACHED", "MISSING_RESPONSE", "VERIFICATION_FAILED"])(
    "explains %s, from billing and the captcha",
    (code) => {
      expect(authErrorKey({ code, status: 400 })).toBe(code);
    }
  );

  it("tells an account locked by two-step verification from rate limiting", () => {
    expect(
      authErrorKey({ code: "ACCOUNT_TEMPORARILY_LOCKED", status: 429 })
    ).toBe("ACCOUNT_TEMPORARILY_LOCKED");
  });

  it.each([
    "INVALID_CODE",
    "INVALID_BACKUP_CODE",
    "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
    "INVALID_TWO_FACTOR_COOKIE",
    "TOTP_ALREADY_ENABLED",
    "EMAIL_NOT_VERIFIED_FOR_TWO_STEP",
    "TWO_STEP_REQUIRED_BY_WORKSPACE",
    "TWO_STEP_REQUIRED",
  ])("explains %s, from two-step verification", (code) => {
    expect(authErrorKey({ code, status: 400 })).toBe(code);
  });

  it("explains rate limiting by its status", () => {
    expect(authErrorKey({ status: 429 })).toBe("TOO_MANY_REQUESTS");
  });

  it("reads any other failure as unknown", () => {
    expect(authErrorKey({ code: "SOMETHING_NEW", status: 400 })).toBe(
      "UNKNOWN"
    );
    expect(authErrorKey({ status: 500 })).toBe("UNKNOWN");
  });
});

describe(providerErrorKey, () => {
  it("reads nothing from an address without an error", () => {
    expect(providerErrorKey(undefined, true)).toStrictEqual(Option.none());
  });

  it.each([
    ["provider_email_unverified", "PROVIDER_EMAIL_UNVERIFIED"],
    ["provider_email_not_authoritative", "PROVIDER_EMAIL_NOT_AUTHORITATIVE"],
    ["email_not_found", "PROVIDER_EMAIL_NOT_FOUND"],
    ["account_not_linked", "PROVIDER_ACCOUNT_NOT_LINKED"],
    ["two_step_password", "PROVIDER_TWO_STEP_PASSWORD"],
    ["signup_disabled", "PROVIDER_SIGN_UP_DISABLED"],
    ["sign_up_by_invitation", "SIGN_UP_BY_INVITATION"],
    ["access_denied", "PROVIDER_ACCESS_DENIED"],
    ["account_banned", "PROVIDER_FAILED"],
  ])("explains %s", (code, key) => {
    expect(providerErrorKey(code, true)).toStrictEqual(Option.some(key));
  });

  it("sends nobody to sign up where the server takes no sign-up", () => {
    expect(providerErrorKey("signup_disabled", false)).toStrictEqual(
      Option.some("PROVIDER_NO_ACCOUNT")
    );
  });

  // Anyone can write the address: what it says is never shown.
  it.each([
    "Your account was suspended, call +1 555 0100",
    "invalid_code",
    "<script>",
  ])("reads an unknown code as a failure: %s", (code) => {
    expect(providerErrorKey(code, true)).toStrictEqual(
      Option.some("PROVIDER_FAILED")
    );
  });

  it("reads a repeated parameter as a failure", () => {
    expect(
      providerErrorKey(["two_step_password", "access_denied"], true)
    ).toStrictEqual(Option.some("PROVIDER_FAILED"));
  });
});
