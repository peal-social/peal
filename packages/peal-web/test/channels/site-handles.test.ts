import { describe, expect, it } from "@effect/vitest";

import { publicationAddressOf } from "#channels/site-handles.ts";

describe(publicationAddressOf, () => {
  it("gives a Hashnode channel's address back, to reconnect it", () => {
    expect(publicationAddressOf("garden.hashnode.example")).toBe(
      "garden.hashnode.example"
    );
  });

  it("gives nothing for a handle that is a user name, not an address", () => {
    expect(publicationAddressOf("synthetic_gardener")).toBe("");
  });
});
