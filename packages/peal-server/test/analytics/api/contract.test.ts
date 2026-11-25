import { describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";
import {
  bestTimesHours,
  bestTimesMinimumPosts,
  bestTimesMinimumPostsPerHour,
  bestTimesPeriods as contractBestTimesPeriods,
  bestTimesSettlingHours,
  countedPlatforms as contractCountedPlatforms,
  postCountsReadForDays,
} from "peal-contract";

import {
  bestHours,
  bestTimesPeriods,
  minimumPosts,
  minimumPostsPerHour,
  settlingHours,
} from "#analytics/domain/best-times.ts";
import { collectedFor } from "#analytics/domain/collection-schedule.ts";
import { countedPlatforms } from "#analytics/domain/counted-platforms.ts";

describe("the contract", () => {
  it("lists the platforms the server reads counts on", () => {
    expect(contractCountedPlatforms).toStrictEqual(countedPlatforms);
  });

  it("says for how many days a post's counts are read, as the server reads them", () => {
    expect(Duration.toDays(collectedFor)).toBe(postCountsReadForDays);
  });

  it("says the floors and the days of best times as the server keeps them", () => {
    expect([
      bestTimesMinimumPosts,
      bestTimesMinimumPostsPerHour,
      bestTimesHours,
      bestTimesSettlingHours,
      contractBestTimesPeriods,
    ]).toStrictEqual([
      minimumPosts,
      minimumPostsPerHour,
      bestHours,
      settlingHours,
      bestTimesPeriods,
    ]);
  });
});
