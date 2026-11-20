// A workspace's pages are `/<slug>/…`, beside every other page of the app at
// the root: no slug may be the first segment of another page, or the page
// would hide the workspace. The server refuses the slugs the contract
// reserves, so each first segment the app routes must be among them.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@effect/vitest";
import {
  isWorkspaceSlug,
  reservedWorkspaceSlugs,
} from "peal-contract/workspace-slug";

import { routing } from "#i18n/routing.ts";
import { createWorkspacePath } from "#shell/workspace-path.ts";

const app = fileURLToPath(new URL("../../src/app", import.meta.url));

// The first segments a folder of routes holds: its folders, a route
// group's own (`(app)`) read through, a dynamic segment (`[workspaceId]`,
// `[...rest]`) left out.
const segmentsIn = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap(({ name }) => {
      if (name.startsWith("(")) {
        return segmentsIn(`${folder}/${name}`);
      }

      return name.startsWith("[") ? [] : [name];
    });

describe("the first segments of the app's addresses", () => {
  it("are all reserved, so no workspace's slug can take one", () => {
    const routed = [
      ...segmentsIn(`${app}/[locale]`),
      ...segmentsIn(app),
      ...routing.locales,
    ];

    expect(routed.length).toBeGreaterThan(10);

    for (const segment of routed) {
      expect(reservedWorkspaceSlugs).toContain(segment);
      expect(isWorkspaceSlug(segment)).toBeFalsy();
    }
  });

  it("hold the setup page's, as the workspace switcher links it", () => {
    const [, first = ""] = createWorkspacePath.split("/");

    expect(reservedWorkspaceSlugs).toContain(first);
  });
});
