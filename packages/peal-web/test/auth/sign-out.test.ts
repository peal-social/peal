import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { signOutAndLoad } from "#auth/sign-out.ts";
import type { SignOutSteps } from "#auth/sign-out.ts";

// Steps that write down what was done, in order, and end the session as
// `ended` says: true, false (the server refused), or a failed request.
const recorded = (ended: boolean | "unreachable") => {
  const calls: string[] = [];

  const steps: SignOutSteps = {
    endSession: async () => {
      calls.push("endSession");

      if (ended === "unreachable") {
        throw new Error("synthetic network failure");
      }

      return await Promise.resolve(ended);
    },
    forgetConversation: () => {
      calls.push("forgetConversation");
    },
    forgetMeasurement: () => {
      calls.push("forgetMeasurement");
    },
    keepNotice: (notice) => {
      calls.push(`keepNotice:${notice}`);
    },
    load: (address) => {
      calls.push(`load:${address}`);
    },
  };

  return { calls, steps };
};

describe("signing out", () => {
  it("ends the session, forgets the person, then loads the next page anew", async () => {
    const { calls, steps } = recorded(true);

    const left = await signOutAndLoad(steps, {
      refused: () => {
        calls.push("refused");
      },
      to: "/fr/login?next=%2Fada%2Fsettings%2Faccount%2Fsecurity",
    });

    expect(left).toBeTruthy();
    expect(calls).toStrictEqual([
      "endSession",
      "forgetMeasurement",
      "forgetConversation",
      "load:/fr/login?next=%2Fada%2Fsettings%2Faccount%2Fsecurity",
    ]);
  });

  it("leaves the person where they are when the server refuses", async () => {
    const { calls, steps } = recorded(false);

    const left = await signOutAndLoad(steps, {
      refused: () => {
        calls.push("refused");
      },
      to: "/",
    });

    expect(left).toBeFalsy();
    expect(calls).toStrictEqual(["endSession", "refused"]);
  });

  it("leaves the person where they are when the server cannot be reached", async () => {
    const { calls, steps } = recorded("unreachable");

    const left = await signOutAndLoad(steps, {
      refused: () => {
        calls.push("refused");
      },
      to: "/",
    });

    expect(left).toBeFalsy();
    expect(calls).toStrictEqual(["endSession", "refused"]);
  });

  it("leaves all the same once the session went with the account, keeping what the next page says", async () => {
    const { calls, steps } = recorded(false);

    const left = await signOutAndLoad(steps, {
      notice: "accountDeleted",
      sessionGone: true,
      to: "/",
    });

    expect(left).toBeTruthy();
    expect(calls).toStrictEqual([
      "endSession",
      "forgetMeasurement",
      "forgetConversation",
      "keepNotice:accountDeleted",
      "load:/",
    ]);
  });
});

// Every file under src/, by its path.
const sources = (folder: string): readonly string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

describe("the sign-out", () => {
  it("is the shared hook's alone, so every way out forgets what the tab holds", () => {
    const root = path.join(import.meta.dirname, "../../src");

    const signingOut = sources(root)
      .filter((file) =>
        /authClient\.signOut\(|import \{ forgetConversation \}/u.test(
          readFileSync(file, "utf-8")
        )
      )
      .map((file) => path.relative(root, file));

    expect(signingOut).toStrictEqual([path.join("auth", "use-sign-out.ts")]);
  });
});
