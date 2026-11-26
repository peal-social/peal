import { describe, expect, it } from "@effect/vitest";
import type { SocialChannel } from "peal-contract";

import {
  answersSearch,
  groupChoiceOf,
  offersSearch,
  platformGroupsOf,
  withGroup,
} from "#posts/channel-groups.ts";

const active: SocialChannel["status"] = { _tag: "active" };

const channel = (
  id: string,
  platform: SocialChannel["platform"],
  status: SocialChannel["status"] = active
): SocialChannel => ({
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: `@peal_${id}`,
  id,
  label: null,
  platform,
  status,
  tokenExpiresAt: null,
});

const workspace = [
  channel("m1", "mastodon"),
  channel("i1", "instagram"),
  channel("m2", "mastodon"),
  channel("i2", "instagram", { _tag: "refreshNeeded" }),
  channel("x1", "x"),
];

describe(platformGroupsOf, () => {
  it("groups each platform where its first channel is, its channels in the list's order", () => {
    expect(
      platformGroupsOf(workspace).map(({ channels, platform }) => [
        platform,
        channels.map(({ id }) => id),
      ])
    ).toStrictEqual([
      ["mastodon", ["m1", "m2"]],
      ["instagram", ["i1", "i2"]],
      ["x", ["x1"]],
    ]);
  });

  it("makes no group without a channel", () => {
    expect(platformGroupsOf([])).toStrictEqual([]);
  });
});

describe(groupChoiceOf, () => {
  const instagram = workspace.filter(
    ({ platform }) => platform === "instagram"
  );

  it("is empty while none of the platform's channels is chosen", () => {
    expect(groupChoiceOf(instagram, ["m1"])).toBe("none");
  });

  it("is ticked once every channel that publishes is, a channel to reconnect left aside", () => {
    expect(groupChoiceOf(instagram, ["i1"])).toBe("all");
  });

  it("is half ticked while some are", () => {
    expect(
      groupChoiceOf(
        workspace.filter(({ platform }) => platform === "mastodon"),
        ["m2"]
      )
    ).toBe("some");
  });

  it("counts a channel to reconnect once it is chosen", () => {
    expect(groupChoiceOf(instagram, ["i1", "i2"])).toBe("all");
    expect(groupChoiceOf(instagram, ["i2"])).toBe("some");
  });
});

// The workspace's channels on one platform: a platform's box, unsearched.
const on = (platform: SocialChannel["platform"]) =>
  workspace.filter((item) => item.platform === platform);

describe(withGroup, () => {
  it("adds every channel of the group that publishes, in the list's order", () => {
    expect(withGroup(workspace, ["x1"], on("mastodon"), true)).toStrictEqual([
      "m1",
      "m2",
      "x1",
    ]);
  });

  it("never adds a channel to reconnect, but keeps one chosen already", () => {
    expect(withGroup(workspace, [], on("instagram"), true)).toStrictEqual([
      "i1",
    ]);
    expect(withGroup(workspace, ["i2"], on("instagram"), true)).toStrictEqual([
      "i1",
      "i2",
    ]);
  });

  it("takes every channel of the group off, the others kept", () => {
    expect(
      withGroup(workspace, ["m1", "i1", "x1"], on("instagram"), false)
    ).toStrictEqual(["m1", "x1"]);
  });

  it("acts on the channels a search shows alone", () => {
    const shown = on("mastodon").filter(({ id }) => id === "m2");

    expect(withGroup(workspace, ["x1"], shown, true)).toStrictEqual([
      "m2",
      "x1",
    ]);
    expect(withGroup(workspace, ["m1", "m2"], shown, false)).toStrictEqual([
      "m1",
    ]);
  });
});

describe(answersSearch, () => {
  const bakery: SocialChannel = {
    ...channel("i3", "instagram"),
    displayName: "Birch Bakery",
    handle: "birch.bakery",
  };

  it("finds a channel by any word of its names or its platform's, in any case", () => {
    expect(answersSearch(bakery, "Instagram", "BIRCH")).toBeTruthy();
    expect(answersSearch(bakery, "Instagram", "insta bakery")).toBeTruthy();
    expect(answersSearch(bakery, "Instagram", "birch.ba")).toBeTruthy();
  });

  it("needs every word", () => {
    expect(answersSearch(bakery, "Instagram", "bakery tiktok")).toBeFalsy();
  });

  it("reads the workspace's own name for the channel", () => {
    expect(
      answersSearch({ ...bakery, label: "Client B" }, "Instagram", "client b")
    ).toBeTruthy();
  });

  it("finds every channel for a blank search", () => {
    expect(answersSearch(bakery, "Instagram", "  ")).toBeTruthy();
  });
});

describe(offersSearch, () => {
  it("offers a search from eight channels", () => {
    expect(offersSearch(Array.from({ length: 7 }))).toBeFalsy();
    expect(offersSearch(Array.from({ length: 8 }))).toBeTruthy();
  });
});
