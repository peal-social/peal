import { describe, expect, it } from "@effect/vitest";

import { makeChooseWorkspace } from "#auth/choose-workspace.ts";
import type { SetActiveAnswer } from "#auth/choose-workspace.ts";

const workspaceId = "00000000-0000-7000-8000-0000000000a1";

// A stand-in for Better Auth's setActive, answering `outcome` (or never,
// while `pending`) and recording what it was asked, and the reports made,
// as the browser's reporter would.
const harness = (outcome: Error | SetActiveAnswer | "pending") => {
  const asked: string[] = [];
  const reported: unknown[] = [];

  const choose = makeChooseWorkspace({
    report: (cause) => {
      reported.push(cause);
    },
    setActive: async (organizationId) => {
      asked.push(organizationId);

      if (outcome === "pending") {
        return await Promise.withResolvers<SetActiveAnswer>().promise;
      }

      if (outcome instanceof Error) {
        throw outcome;
      }

      return outcome;
    },
  });

  return { asked, choose, reported };
};

describe(makeChooseWorkspace, () => {
  it("makes the workspace chosen the session's active one", async () => {
    const { asked, choose, reported } = harness({ error: null });

    await choose(workspaceId);

    expect(asked).toStrictEqual([workspaceId]);
    expect(reported).toStrictEqual([]);
  });

  it("asks before it waits, so the link it follows goes on at once", () => {
    const { asked, choose } = harness("pending");

    void choose(workspaceId);

    expect(asked).toStrictEqual([workspaceId]);
  });

  it("reports an error Better Auth answers, and never fails", async () => {
    const { choose, reported } = harness({
      error: { code: "ORGANIZATION_NOT_FOUND", status: 400 },
    });

    await expect(choose(workspaceId)).resolves.toBeUndefined();
    expect(reported).toHaveLength(1);
    expect(String(reported[0])).toContain("ORGANIZATION_NOT_FOUND");
  });

  it("reports a request that could not be sent, and never fails", async () => {
    const failure = new TypeError("Failed to fetch");
    const { choose, reported } = harness(failure);

    await expect(choose(workspaceId)).resolves.toBeUndefined();
    expect(reported).toStrictEqual([failure]);
  });
});
