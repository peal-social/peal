import { describe, expect, it } from "@effect/vitest";

import {
  admitProviderUser,
  providerRefusalCodes,
} from "#workspace/infrastructure/auth/provider-admission.ts";
import type {
  AdmissionReads,
  StoredStanding,
} from "#workspace/infrastructure/auth/provider-admission.ts";

type Action = "create-user" | "link-account" | "sign-in";

const now = new Date("2026-11-16T09:00:00.000Z");

const invitationId = "0b9f1c2e-4f2a-4d4b-9a51-3c1f6f0a2b7e";

const standing = (overrides: Partial<StoredStanding> = {}): StoredStanding => ({
  banExpires: null,
  banned: false,
  twoFactorEnabled: false,
  ...overrides,
});

const reads = (
  overrides: Partial<AdmissionReads> = {}
): AdmissionReads & { readonly asked: unknown[] } => {
  const asked: unknown[] = [];

  return {
    account: async () => await Promise.resolve(standing()),
    asked,
    invitationId: async () => await Promise.resolve(invitationId),
    now: () => now,
    signUp: async (email, invitation) => {
      asked.push([email, invitation]);

      return await Promise.resolve(true);
    },
    ...overrides,
  };
};

const data = (
  action: Action,
  emailVerified: boolean | undefined,
  method = "oauth"
) => ({
  source:
    method === "oauth"
      ? { action, method, oauth: { providerId: "oidc" } }
      : { action, method },
  // Better Auth asks before it makes a user, which has no id yet.
  user:
    action === "create-user"
      ? { email: "ada@example.test", emailVerified }
      : {
          email: "ada@example.test",
          emailVerified,
          id: "8d3f5b8e-6a51-4c58-9d1e-0f3e2b6a7c90",
        },
});

describe("who a provider may sign in", () => {
  it("leaves every other way of signing up to its own rules", async () => {
    const checks = reads();

    await expect(
      admitProviderUser(data("create-user", false, "email-password"), checks)
    ).resolves.toBeUndefined();
    expect(checks.asked).toStrictEqual([]);
  });

  it.each([
    ["create-user", false],
    ["create-user", undefined],
    ["link-account", false],
    ["sign-in", false],
  ] as const)(
    "refuses an address the provider did not confirm (%s, %s)",
    async (action, verified) => {
      await expect(
        admitProviderUser(data(action, verified), reads())
      ).resolves.toStrictEqual({ error: "provider_email_unverified" });
    }
  );

  it.each(["link-account", "sign-in"] as const)(
    "sends an account with two-step verification to its password (%s)",
    async (action) => {
      await expect(
        admitProviderUser(
          data(action, true),
          reads({
            account: async () =>
              await Promise.resolve(standing({ twoFactorEnabled: true })),
          })
        )
      ).resolves.toStrictEqual({ error: "two_step_password" });
    }
  );

  it.each(["link-account", "sign-in"] as const)(
    "refuses a banned account, or one it cannot read (%s)",
    async (action) => {
      const banned = reads({
        account: async () => await Promise.resolve(standing({ banned: true })),
      });

      await expect(
        admitProviderUser(data(action, true), banned)
      ).resolves.toStrictEqual({
        error: "account_banned",
      });

      const gone = reads({ account: async () => await Promise.resolve(null) });

      await expect(
        admitProviderUser(data(action, true), gone)
      ).resolves.toStrictEqual({
        error: "account_banned",
      });
    }
  );

  it("lets a ban that ran out go on, as the admin plugin then lifts it", async () => {
    const lapsed = reads({
      account: async () =>
        await Promise.resolve(
          standing({
            banExpires: new Date("2026-11-15T09:00:00.000Z"),
            banned: true,
          })
        ),
    });

    await expect(
      admitProviderUser(data("sign-in", true), lapsed)
    ).resolves.toBeUndefined();
  });

  it("admits a confirmed account without two-step verification", async () => {
    await expect(
      admitProviderUser(data("link-account", true), reads())
    ).resolves.toBeUndefined();
    await expect(
      admitProviderUser(data("sign-in", true), reads())
    ).resolves.toBeUndefined();
  });

  it("asks the sign-up gate before making an account, with the invitation", async () => {
    const open = reads();

    await expect(
      admitProviderUser(data("create-user", true), open)
    ).resolves.toBeUndefined();
    expect(open.asked).toStrictEqual([["ada@example.test", invitationId]]);

    const closed = reads({
      signUp: async () => await Promise.resolve(false),
    });

    await expect(
      admitProviderUser(data("create-user", true), closed)
    ).resolves.toStrictEqual({ error: "sign_up_by_invitation" });
  });

  it.each([
    ["an upper-case id", invitationId.toUpperCase()],
    ["no UUID", "not-an-invitation"],
    ["no id", undefined],
  ])("names no invitation for %s", async (_, given) => {
    const checks = reads({
      invitationId: async () => await Promise.resolve(given),
    });

    await admitProviderUser(data("create-user", true), checks);

    expect(checks.asked).toStrictEqual([["ada@example.test", undefined]]);
  });

  it("refuses when the gate fails, rather than throwing", async () => {
    const failing = reads({
      signUp: async () => await Promise.reject(new Error("database down")),
    });

    await expect(
      admitProviderUser(data("create-user", true), failing)
    ).resolves.toStrictEqual({ error: "sign_up_by_invitation" });
  });

  it("answers with codes an address can carry", () => {
    for (const code of providerRefusalCodes) {
      expect(code).toMatch(/^[a-z]+(?:_[a-z]+)*$/u);
    }
  });
});

// Google is the authority for an address only when it is a Gmail address,
// or when Google Workspace manages its domain (`hd`): any other address
// Google once confirmed may have changed hands since.
const fromGoogle = (
  action: Action,
  email: string,
  hd?: string
): Parameters<typeof admitProviderUser>[0] => ({
  source: {
    action,
    method: "oauth",
    oauth: {
      hd,
      providerId: "google",
    },
  },
  user:
    action === "create-user"
      ? { email, emailVerified: true }
      : {
          email,
          emailVerified: true,
          id: "8d3f5b8e-6a51-4c58-9d1e-0f3e2b6a7c90",
        },
});

describe("whom Google may vouch for", () => {
  it.each(["create-user", "link-account", "sign-in"] as const)(
    "refuses an address on a domain Google does not manage (%s)",
    async (action) => {
      await expect(
        admitProviderUser(fromGoogle(action, "marketing@corp.example"), reads())
      ).resolves.toStrictEqual({ error: "provider_email_not_authoritative" });
    }
  );

  it.each(["create-user", "link-account", "sign-in"] as const)(
    "admits a Gmail address, whatever its case (%s)",
    async (action) => {
      await expect(
        admitProviderUser(fromGoogle(action, "Ada.Lovelace@GMAIL.com"), reads())
      ).resolves.toBeUndefined();
    }
  );

  it.each(["create-user", "link-account", "sign-in"] as const)(
    "admits an address of the domain Google Workspace manages (%s)",
    async (action) => {
      await expect(
        admitProviderUser(
          fromGoogle(action, "ada@corp.example", "Corp.Example"),
          reads()
        )
      ).resolves.toBeUndefined();
    }
  );

  it("refuses an address of another domain than the one Google manages", async () => {
    await expect(
      admitProviderUser(
        fromGoogle("link-account", "ada@corp.example", "other.example"),
        reads()
      )
    ).resolves.toStrictEqual({ error: "provider_email_not_authoritative" });
    await expect(
      admitProviderUser(
        fromGoogle("link-account", "ada@sub.corp.example", "corp.example"),
        reads()
      )
    ).resolves.toStrictEqual({ error: "provider_email_not_authoritative" });
    await expect(
      admitProviderUser(fromGoogle("link-account", "ada@notgmail.com"), reads())
    ).resolves.toStrictEqual({ error: "provider_email_not_authoritative" });
  });

  it("leaves the operator's own provider to its email_verified", async () => {
    await expect(
      admitProviderUser(
        {
          ...fromGoogle("link-account", "marketing@corp.example"),
          source: {
            action: "link-account",
            method: "oauth",
            oauth: { providerId: "oidc" },
          },
        },
        reads()
      )
    ).resolves.toBeUndefined();
  });
});

describe("the address a provider gives", () => {
  it.each([
    "not an address",
    "two@at@example.test",
    "spaced out@example.test",
    "@example.test",
    "ada@",
    `${"a".repeat(250)}@example.test`,
    "ada\u0000@example.test",
  ])("is refused when it is no address: %j", async (email) => {
    await expect(
      admitProviderUser(
        {
          source: {
            action: "create-user",
            method: "oauth",
            oauth: { providerId: "oidc" },
          },
          user: { email, emailVerified: true },
        },
        reads()
      )
    ).resolves.toStrictEqual({ error: "provider_email_invalid" });
  });
});
