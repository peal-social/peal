// The header's GitHub star count, which the site reads once a build and the
// blog once an hour, is hidden when GitHub does not answer with one.
import { describe, expect, it } from "vitest";

import { fetchStars, formatStars, starsFrom } from "../src/lib/site/stars";

// What GitHub's API answers, or a refusal with its message.
interface GitHubAnswer {
  readonly message?: string;
  readonly stargazers_count?: number;
}

const answer = (status: number, body: GitHubAnswer) => async () =>
  await Promise.resolve(Response.json(body, { status }));

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
