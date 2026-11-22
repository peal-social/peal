import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { authErrorKey, providerErrorKey } from "#auth/errors.ts";

describe(authErrorKey, () => {
  it("explains the errors Better Auth reports by code", () => {
    expect(
      authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })
    ).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it.each(["INVALID_NAME", "INVALID_WORKSPACE_NAME"])(
    "explains %s, a name that is not one line or reads as a link",
    (code) => {
      expect(authErrorKey({ code, status: 400 })).toBe(code);
    }
  );

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

const offered = {
  fromProvider: true,
  providersOffered: true,
  signUpOffered: true,
};

describe(providerErrorKey, () => {
  it("reads nothing from an address without an error", () => {
    expect(providerErrorKey(undefined, offered)).toStrictEqual(Option.none());
  });

  it.each([
    ["provider_email_unverified", "PROVIDER_EMAIL_UNVERIFIED"],
    ["provider_email_invalid", "PROVIDER_EMAIL_INVALID"],
    ["provider_email_not_authoritative", "PROVIDER_EMAIL_NOT_AUTHORITATIVE"],
    ["email_not_found", "PROVIDER_EMAIL_NOT_FOUND"],
    ["account_not_linked", "PROVIDER_ACCOUNT_NOT_LINKED"],
    ["two_step_password", "PROVIDER_TWO_STEP_PASSWORD"],
    ["signup_disabled", "PROVIDER_SIGN_UP_DISABLED"],
    ["sign_up_by_invitation", "SIGN_UP_BY_INVITATION"],
    ["access_denied", "PROVIDER_ACCESS_DENIED"],
    ["account_banned", "PROVIDER_FAILED"],
  ])("explains %s", (code, key) => {
    expect(providerErrorKey(code, offered)).toStrictEqual(Option.some(key));
  });

  it("sends nobody to sign up where the server takes no sign-up", () => {
    expect(
      providerErrorKey("signup_disabled", {
        fromProvider: true,
        providersOffered: true,
        signUpOffered: false,
      })
    ).toStrictEqual(Option.some("PROVIDER_NO_ACCOUNT"));
  });

  // What Better Auth's provider callback answers on its own.
  it.each(["invalid_code", "state_mismatch", "unable_to_get_user_info"])(
    "reads the provider flow's own %s as the provider's failure",
    (code) => {
      expect(providerErrorKey(code, offered)).toStrictEqual(
        Option.some("PROVIDER_FAILED")
      );
    }
  );

  // Anyone can write the address: what it says is never shown.
  it.each(["Your account was suspended, call +1 555 0100", "<script>"])(
    "reads an unknown code as a plain failure: %s",
    (code) => {
      expect(providerErrorKey(code, offered)).toStrictEqual(
        Option.some("UNKNOWN")
      );
    }
  );

  // An application's authorization (an MCP client's, the command line's)
  // that the server refused sends the browser here too, unmarked.
  it.each([
    "invalid_client",
    "invalid_redirect",
    "invalid_scope",
    "client_disabled",
    "server_error",
    "login_required",
  ])(
    "tells %s as the application's refused request, a provider or not",
    (code) => {
      for (const providersOffered of [true, false]) {
        expect(
          providerErrorKey(code, {
            fromProvider: false,
            providersOffered,
            signUpOffered: true,
          })
        ).toStrictEqual(Option.some("AUTHORIZATION_FAILED"));
      }
    }
  );

  // A provider sends the same codes back to its callback, which passes
  // them on to the page the sign-in started from, marked.
  it.each([
    "server_error",
    "temporarily_unavailable",
    "login_required",
    "consent_required",
    "interaction_required",
    "invalid_request",
  ])(
    "tells %s from the provider's callback as the provider's failure",
    (code) => {
      expect(providerErrorKey(code, offered)).toStrictEqual(
        Option.some("PROVIDER_FAILED")
      );
    }
  );

  it("reads a repeated parameter as a failure", () => {
    expect(
      providerErrorKey(["two_step_password", "access_denied"], offered)
    ).toStrictEqual(Option.some("UNKNOWN"));
  });

  // Better Auth sends its other errors to the sign-in page too, such as an
  // OAuth client's: they are no provider's on a server without one.
  it.each(["unable_to_get_user_info", "two_step_password"])(
    "reads %s as a plain failure where no provider is offered",
    (code) => {
      expect(
        providerErrorKey(code, {
          fromProvider: false,
          providersOffered: false,
          signUpOffered: true,
        })
      ).toStrictEqual(Option.some("UNKNOWN"));
    }
  );
});
