// The home page's latest merged pull requests, read once at build time, and
// hidden when GitHub does not answer with them.
import { describe, expect, it } from "vitest";

import { fetchMergedPulls, pullTitle } from "../src/github.ts";

// A pull request as GitHub's API lists it.
interface GitHubPull {
  readonly html_url: string;
  readonly merged_at: string | null;
  readonly number: number;
  readonly title: string;
}

// What GitHub's API answers to a refusal.
interface GitHubAnswer {
  readonly message?: string;
}

const answer =
  (status: number, body: GitHubAnswer | readonly GitHubPull[]) => async () =>
    await Promise.resolve(Response.json(body, { status }));

const pull = (
  number: number,
  mergedAt: string | null,
  title = "a change"
): GitHubPull => ({
  html_url: `https://github.test/${number}`,
  merged_at: mergedAt,
  number,
  title,
});

describe("the latest merged pull requests", () => {
  it.each([
    [
      "feat: a comment rule's private reply after its public one (U13b)",
      "feat: a comment rule's private reply after its public one",
    ],
    [
      "fix: harden Meta's direct messages before they are switched on (N1 to N5, DM L2 and L4)",
      "fix: harden Meta's direct messages before they are switched on",
    ],
    [
      "feat(infra): alert when Meta still sends an erased workspace's messages",
      "feat(infra): alert when Meta still sends an erased workspace's messages",
    ],
    ["fix: keep the (optional) note", "fix: keep the (optional) note"],
  ])("shows %j as %j", (title, shown) => {
    expect(pullTitle(title)).toBe(shown);
  });

  it("keeps the three merged last, newest first", async () => {
    const pulls = await fetchMergedPulls(
      answer(200, [
        pull(1, "2026-11-01T00:00:00Z"),
        pull(2, null),
        pull(3, "2026-11-03T00:00:00Z", "three (U1)"),
        pull(4, "2026-11-02T00:00:00Z"),
        pull(5, "2026-10-01T00:00:00Z"),
      ])
    );

    expect(pulls.map((item) => item.number)).toStrictEqual([3, 4, 1]);
    expect(pulls[0]?.title).toBe("three");
  });

  it("gives none when GitHub refuses", async () => {
    await expect(
      fetchMergedPulls(answer(403, { message: "rate limited" }))
    ).resolves.toStrictEqual([]);
  });
});
