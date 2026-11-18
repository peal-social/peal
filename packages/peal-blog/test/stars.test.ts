// The blog renders on request, so it asks GitHub for the star count at most
// once an hour.
import { describe, expect, it } from "vitest";

import { starMemo } from "../src/stars.ts";

describe("the star count", () => {
  it("asks GitHub once an hour", async () => {
    let asked = 0;
    let time = 0;

    const memo = starMemo(
      async () => {
        asked += 1;

        return await Promise.resolve(
          Response.json({ stargazers_count: 40 + asked })
        );
      },
      () => time
    );

    await expect(memo.stars()).resolves.toBe(41);

    time = 59 * 60 * 1000;

    await expect(memo.stars()).resolves.toBe(41);

    time = 60 * 60 * 1000;

    await expect(memo.stars()).resolves.toBe(42);
    expect(asked).toBe(2);
  });

  it("keeps a failure for the hour too", async () => {
    let asked = 0;

    const memo = starMemo(
      async () => {
        asked += 1;

        return await Promise.reject(new TypeError("offline"));
      },
      () => 0
    );

    await expect(memo.stars()).resolves.toBeUndefined();
    await expect(memo.stars()).resolves.toBeUndefined();
    expect(asked).toBe(1);
  });
});
