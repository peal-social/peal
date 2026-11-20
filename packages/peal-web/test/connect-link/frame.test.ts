import { describe, expect, it } from "@effect/vitest";

import { frameOf } from "#connect-link/frame.ts";

describe(frameOf, () => {
  it("leaves the signed-in app's pages to their own frame", () => {
    for (const path of [
      "/",
      "/create",
      "/fr/create",
      "/synthetic-studio/settings/account",
      "/00000000-0000-7000-8000-0000000000a1",
      "/00000000-0000-7000-8000-0000000000a1/settings/tags",
    ]) {
      expect(frameOf(path, false)).toBe("own");
    }
  });

  it("keeps the app's frame elsewhere", () => {
    for (const path of ["/admin/users", "/oauth/consent", "/cancel"]) {
      expect(frameOf(path, false)).toBe("app");
    }
  });

  it("gives the sign-in pages theirs", () => {
    for (const path of [
      "/login",
      "/fr/signup",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
    ]) {
      expect(frameOf(path, false)).toBe("signIn");
    }
  });

  it("keeps a connect link's pages hosted", () => {
    expect(frameOf("/connect/link", false)).toBe("hosted");
    expect(frameOf("/connect/x/callback", true)).toBe("hosted");
    expect(frameOf("/connect/x/callback", false)).toBe("app");
  });
});
