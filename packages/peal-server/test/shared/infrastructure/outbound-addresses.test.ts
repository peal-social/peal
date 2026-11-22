// Whether the outbound guard lets a request go to a host, from the
// addresses its name resolved to: all of them public, and at least one.
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import { NetAddress } from "effect/net";

import { allPublic } from "#shared/infrastructure/platforms/outbound-guard.ts";

const address = (written: string) =>
  Result.getOrThrow(NetAddress.ipFromString(written));

describe(allPublic, () => {
  it("refuses a host with no address, as every address of none is public", () => {
    expect(allPublic([])).toBeFalsy();
  });

  it("takes a host whose addresses are all public, and no other", () => {
    expect(allPublic([address("93.184.215.14")])).toBeTruthy();
    expect(
      allPublic([address("93.184.215.14"), address("10.1.2.3")])
    ).toBeFalsy();
  });
});
