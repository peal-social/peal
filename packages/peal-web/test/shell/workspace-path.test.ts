import { describe, expect, it } from "@effect/vitest";

import {
  homeWorkspaceOf,
  isWorkspaceSegment,
  namesWorkspaceById,
  slugAddressOf,
  workspaceAt,
  workspacePath,
} from "#shell/workspace-path.ts";

const studio = {
  id: "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e31",
  slug: "synthetic-studio",
};

const atelier = {
  id: "6c2d6a8f-4e3b-4d2c-8f9a-8b7c6d5e4f42",
  slug: "atelier-1a2b3c4d",
};

// A workspace a partner made, whose slug is its id.
const customer = {
  id: "7d3e7b9a-5f4c-4e3d-9a8b-9c8d7e6f5a53",
  slug: "7d3e7b9a-5f4c-4e3d-9a8b-9c8d7e6f5a53",
};

describe(workspacePath, () => {
  it("writes a workspace's page under its slug", () => {
    expect(workspacePath("synthetic-studio")).toBe("/synthetic-studio");
    expect(workspacePath("synthetic-studio", "/posts?status=draft")).toBe(
      "/synthetic-studio/posts?status=draft"
    );
  });
});

describe(workspaceAt, () => {
  it("finds a workspace by its slug, or by its id as older links name it", () => {
    expect(workspaceAt([studio, atelier], "atelier-1a2b3c4d")).toBe(atelier);
    expect(workspaceAt([studio, atelier], studio.id)).toBe(studio);
    expect(workspaceAt([studio], "elsewhere")).toBeUndefined();
  });
});

describe(namesWorkspaceById, () => {
  it("tells the old form of a workspace's addresses", () => {
    expect(namesWorkspaceById(`/${studio.id}`)).toBeTruthy();
    expect(namesWorkspaceById(`/fr/${studio.id}/posts`)).toBeTruthy();
    expect(namesWorkspaceById("/synthetic-studio/posts")).toBeFalsy();
    expect(namesWorkspaceById(`/admin/workspaces/${studio.id}`)).toBeFalsy();
  });
});

describe(slugAddressOf, () => {
  it("sends an address with the id on to the same page under the slug", () => {
    expect(
      slugAddressOf(
        { pathname: `/${studio.id}/posts/abc`, search: "?status=draft" },
        [atelier, studio]
      )
    ).toBe("/synthetic-studio/posts/abc?status=draft");
    expect(
      slugAddressOf({ pathname: `/fr/${studio.id}`, search: "" }, [studio])
    ).toBe("/fr/synthetic-studio");
  });

  it("leaves a workspace the person is not in, and one whose slug is its id", () => {
    expect(
      slugAddressOf({ pathname: `/${studio.id}`, search: "" }, [atelier])
    ).toBeNull();
    expect(
      slugAddressOf({ pathname: `/${customer.id}`, search: "" }, [customer])
    ).toBeNull();
    expect(
      slugAddressOf({ pathname: "/synthetic-studio", search: "" }, [studio])
    ).toBeNull();
  });
});

describe(homeWorkspaceOf, () => {
  it("opens the active workspace, else the first", () => {
    expect(homeWorkspaceOf([studio, atelier], atelier.id)).toBe(atelier);
    expect(homeWorkspaceOf([studio, atelier], null)).toBe(studio);
    expect(homeWorkspaceOf([studio], customer.id)).toBe(studio);
    expect(homeWorkspaceOf<typeof studio>([], null)).toBeUndefined();
  });
});

describe(isWorkspaceSegment, () => {
  it("tells a workspace's segment from the app's other pages", () => {
    expect(isWorkspaceSegment("synthetic-studio")).toBeTruthy();
    expect(isWorkspaceSegment("create")).toBeFalsy();
    expect(isWorkspaceSegment("login")).toBeFalsy();
    expect(isWorkspaceSegment("")).toBeFalsy();
  });
});
