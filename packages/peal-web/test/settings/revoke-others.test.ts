import { describe, expect, it } from "@effect/vitest";

import type { AuthClientError } from "#auth/errors.ts";
import { signOutOtherSessions } from "#settings/revoke-others.ts";
import type { RevokeOthersSteps } from "#settings/revoke-others.ts";

// Steps that write down what was done, Better Auth answering as `answer`
// says: no error, an error, or a request that never got an answer.
const recorded = (answer: AuthClientError | null | "unreachable") => {
  const calls: string[] = [];

  const steps: RevokeOthersSteps = {
    refused: (reason) => {
      calls.push(`refused:${reason}`);
    },
    revoke: async () => {
      calls.push("revoke");

      if (answer === "unreachable") {
        throw new Error("synthetic network failure");
      }

      return await Promise.resolve({ error: answer });
    },
    signedOut: () => {
      calls.push("signedOut");
    },
  };

  return { calls, steps };
};

describe(signOutOtherSessions, () => {
  it("signs out the other sessions, then says so", async () => {
    const { calls, steps } = recorded(null);

    await expect(signOutOtherSessions(steps)).resolves.toBeTruthy();
    expect(calls).toStrictEqual(["revoke", "signedOut"]);
  });

  it("says why when Better Auth refuses, and changes nothing else", async () => {
    // This session ended meanwhile, or the server failed.
    const refusals: readonly AuthClientError[] = [
      { code: "UNAUTHORIZED", status: 401 },
      { status: 500 },
      { status: 429 },
    ];

    const outcomes = await Promise.all(
      refusals.map(async (refusal) => {
        const { calls, steps } = recorded(refusal);

        return { calls, signedOut: await signOutOtherSessions(steps) };
      })
    );

    expect(outcomes).toStrictEqual([
      { calls: ["revoke", "refused:unknown"], signedOut: false },
      { calls: ["revoke", "refused:unknown"], signedOut: false },
      { calls: ["revoke", "refused:tooManyRequests"], signedOut: false },
    ]);
  });

  it("reads a request that never got an answer as a failure", async () => {
    const { calls, steps } = recorded("unreachable");

    await expect(signOutOtherSessions(steps)).resolves.toBeFalsy();
    expect(calls).toStrictEqual(["revoke", "refused:unknown"]);
  });
});
