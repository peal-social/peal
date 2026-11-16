import { describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";

import { AdNetworkSchema } from "#ads/domain/ad-network.ts";
import { networkTraits } from "#ads/domain/network-traits.ts";

describe("networkTraits", () => {
  it("describes every network", () => {
    expect(Object.keys(networkTraits).toSorted()).toStrictEqual(
      [...AdNetworkSchema.literals].toSorted()
    );
  });

  it.each([
    {
      days: "ad",
      network: "meta",
      reportsReach: true,
      reportsResults: true,
      spends: true,
      syncEvery: Duration.hours(1),
    },
    {
      days: "campaign",
      network: "google",
      reportsReach: false,
      reportsResults: false,
      spends: false,
      syncEvery: Duration.hours(6),
    },
  ] as const)("$network", ({ network, syncEvery, ...traits }) => {
    const described = networkTraits[network];

    expect({
      days: described.days,
      reportsReach: described.reportsReach,
      reportsResults: described.reportsResults,
      spends: described.spends,
    }).toStrictEqual(traits);
    expect(Duration.equals(described.syncEvery, syncEvery)).toBe(true);
  });
});
