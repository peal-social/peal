import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { carriedBy } from "#engagement/infrastructure/platforms/message-platform.ts";

// A channel's events come through one app's subscription: a Page's, which
// carries the Page and the Instagram account linked to it, or Instagram
// Login's, the account's own. One never keeps the other's alive.

describe("whose subscription carries a channel's events", () => {
  it("tells an Instagram account through its Page from one through Instagram Login", () => {
    const throughPage = {
      accountId: "17841400000000001",
      connection: "facebookLogin",
      platform: "instagram",
    } as const;

    expect(
      carriedBy(throughPage, {
        connection: Option.some("facebookLogin"),
        platform: "instagram",
      })
    ).toBeTruthy();
    // Stored without a way in: it came through a Page.
    expect(
      carriedBy(throughPage, {
        connection: Option.none(),
        platform: "instagram",
      })
    ).toBeTruthy();
    expect(
      carriedBy(throughPage, {
        connection: Option.some("instagramLogin"),
        platform: "instagram",
      })
    ).toBeFalsy();
    expect(
      carriedBy(
        { ...throughPage, connection: "instagramLogin" },
        { connection: Option.some("instagramLogin"), platform: "instagram" }
      )
    ).toBeTruthy();
  });

  it("carries every channel of a Page", () => {
    expect(
      carriedBy(
        {
          accountId: "102000000000001",
          connection: "facebookLogin",
          platform: "facebook",
        },
        { connection: Option.none(), platform: "facebook" }
      )
    ).toBeTruthy();
  });
});
