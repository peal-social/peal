// Which pages the web app measures, and how: the three modes, from what
// GET /api/me says, the page, and what the browser asks.
import { describe, expect, it } from "@effect/vitest";

import { modeOf } from "#measurement/mode.ts";
import { placeOf } from "#measurement/place.ts";

const workspaceId = "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70";
const excludedId = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a81";

const settings = (consent: "granted" | "refused" | "undecided") => ({
  consent,
  excludedWorkspaceIds: [excludedId],
});

const none = { doNotTrack: false, globalPrivacyControl: false };

describe(modeOf, () => {
  it.each([
    // Null where the server measures nothing for this person: no key,
    // PEAL_POSTHOG_WEB off, staff acting as them, an excluded person.
    ["no measurement", null, "/", none, "off"],
    ["an older server", undefined, "/", none, "off"],
    ["a page outside the app", settings("granted"), "/sign-in", none, "off"],
    ["the staff console", settings("granted"), "/admin", none, "off"],
    [
      "an excluded workspace",
      settings("granted"),
      `/${excludedId}/posts`,
      none,
      "off",
    ],
    [
      "Do Not Track",
      settings("granted"),
      "/",
      { doNotTrack: true, globalPrivacyControl: false },
      "off",
    ],
    [
      "Global Privacy Control",
      settings("undecided"),
      "/",
      { doNotTrack: false, globalPrivacyControl: true },
      "off",
    ],
    ["no choice yet", settings("undecided"), "/", none, "anonymous"],
    ["a refusal", settings("refused"), `/${workspaceId}`, none, "anonymous"],
    [
      "a consent",
      settings("granted"),
      `/fr/${workspaceId}`,
      none,
      "identified",
    ],
  ] as const)("is right for %s", (_, given, path, signals, mode) => {
    expect(modeOf({ place: placeOf(path), settings: given, signals })).toBe(
      mode
    );
  });
});

describe(placeOf, () => {
  it.each([
    ["/", { pattern: "/", workspaceId: null }],
    ["/fr", { pattern: "/", workspaceId: null }],
    ["/account", { pattern: "/account", workspaceId: null }],
    [
      `/${workspaceId}/posts?status=draft#top`,
      { pattern: "/:id/posts", workspaceId },
    ],
    [
      `/fr/${workspaceId}/posts/019a7b2c-3d4e-7f50-8a1b-2c3d4e5f6a7b`,
      { pattern: "/:id/posts/:id", workspaceId },
    ],
  ])("reads %s", (path, place) => {
    expect(placeOf(path)).toStrictEqual(place);
  });

  it("reads a workspace's page by its slug, as its id", () => {
    expect(
      placeOf("/fr/synthetic-studio/posts?status=draft", [
        { id: workspaceId, slug: "synthetic-studio" },
      ])
    ).toStrictEqual({ pattern: "/:id/posts", workspaceId });
    expect(placeOf("/synthetic-studio/posts")).toStrictEqual({
      pattern: "/:id/posts",
      workspaceId: null,
    });
  });

  it.each([
    "/admin",
    "/fr/admin/users",
    "/sign-in",
    "/connect/link",
    "/oauth/consent",
    "/review",
  ])("measures nothing of %s", (path) => {
    expect(placeOf(path)).toBeNull();
  });
});
