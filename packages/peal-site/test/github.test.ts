// The header's GitHub star count is read once at build time, and hidden
// when GitHub does not answer with one.
import { describe, expect, it } from "vitest";

import {
  fetchMergedPulls,
  fetchStars,
  formatStars,
  pullTitle,
  starsFrom,
} from "../src/github.ts";

// A pull request as GitHub's API lists it.
interface GitHubPull {
  readonly html_url: string;
  readonly merged_at: string | null;
  readonly number: number;
  readonly title: string;
}

// What GitHub's API answers, or a refusal with its message.
interface GitHubAnswer {
  readonly message?: string;
  readonly stargazers_count?: number;
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

describe("the star count", () => {
  it("reads stargazers_count from the repository's answer", async () => {
    await expect(
      starsFrom(
        Response.json({ full_name: "peal-social/peal", stargazers_count: 42 })
      )
    ).resolves.toBe(42);
  });

  it.each([
    { body: {}, name: "a missing count" },
    { body: { stargazers_count: "42" }, name: "a count as text" },
    { body: { stargazers_count: -1 }, name: "a negative count" },
    { body: { stargazers_count: 1.5 }, name: "a fraction" },
    { body: [], name: "a list" },
  ])("reads nothing from $name", async ({ body }) => {
    await expect(starsFrom(Response.json(body))).resolves.toBeUndefined();
  });

  it("gives nothing for an answer that is not JSON", async () => {
    await expect(
      fetchStars(async () => await Promise.resolve(new Response("<html>")))
    ).resolves.toBeUndefined();
  });

  it("fetches the count", async () => {
    await expect(
      fetchStars(answer(200, { stargazers_count: 1234 }))
    ).resolves.toBe(1234);
  });

  it("gives nothing when GitHub refuses", async () => {
    await expect(
      fetchStars(answer(403, { message: "rate limited" }))
    ).resolves.toBeUndefined();
  });

  it("gives nothing when the request fails", async () => {
    await expect(
      fetchStars(async () => await Promise.reject(new TypeError("offline")))
    ).resolves.toBeUndefined();
  });

  it.each([
    { count: 7, locale: "en", shown: "7" },
    { count: 1234, locale: "en", shown: "1.2K" },
    { count: 1234, locale: "fr", shown: "1,2 k" },
  ] as const)(
    "shows $count as $shown in $locale",
    ({ count, locale, shown }) => {
      expect(formatStars(count, locale).replaceAll(" ", " ")).toBe(shown);
    }
  );
});
