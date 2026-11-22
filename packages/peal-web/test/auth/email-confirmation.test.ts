import { describe, expect, it } from "@effect/vitest";

import { confirmationResultOf } from "#auth/email-confirmation.ts";

describe(confirmationResultOf, () => {
  it.each([
    "alreadyConfirmed",
    "inUse",
    "passwordNeeded",
    "replaced",
    "signedIn",
  ] as const)("reads the server's %s", (status) => {
    expect(confirmationResultOf({ data: { status }, error: null })).toBe(
      status
    );
  });

  it("tells an expired link from one that never worked", () => {
    expect(
      confirmationResultOf({
        data: null,
        error: { code: "TOKEN_EXPIRED", status: 400 },
      })
    ).toBe("expired");
    expect(
      confirmationResultOf({
        data: null,
        error: { code: "INVALID_TOKEN", status: 400 },
      })
    ).toBe("invalid");
  });

  it("reads anything else as a failure to try again", () => {
    expect(
      confirmationResultOf({ data: { status: "somethingNew" }, error: null })
    ).toBe("failed");
    expect(confirmationResultOf({ data: null, error: { status: 500 } })).toBe(
      "failed"
    );
  });
});
