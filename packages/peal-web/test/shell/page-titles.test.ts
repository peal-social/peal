// The browser's tab names the page (DESIGN.md, "Page names"): every page of
// the signed-in app names itself, which the layouts follow with the
// workspace's name or Peal's. A page without a title would show the
// layout's alone, so a new page must not forget it.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@effect/vitest";

const app = fileURLToPath(
  new URL("../../src/app/[locale]/(app)", import.meta.url)
);

// Drafts and Approvals open their tabs of Posts, Articles its Type filter,
// Calendar its calendar layout, and Invitations opens Members, the
// addresses they had kept working.
const redirectsOnly = new Set([
  "[workspaceId]/articles/page.tsx",
  "[workspaceId]/approvals/page.tsx",
  "[workspaceId]/calendar/page.tsx",
  "[workspaceId]/drafts/page.tsx",
  "[workspaceId]/settings/invitations/page.tsx",
]);

const pagesIn = (folder: string, prefix = ""): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = `${prefix}${entry.name}`;

    if (entry.isDirectory()) {
      return pagesIn(`${folder}/${entry.name}`, `${path}/`);
    }

    return entry.name === "page.tsx" ? [path] : [];
  });

describe("the app's pages", () => {
  it("each name themselves for the browser's tab", () => {
    const pages = pagesIn(app).filter((page) => !redirectsOnly.has(page));

    const untitled = pages.filter(
      (page) =>
        !/export const generateMetadata = workspacePageTitle\(|export \{ (?:setupPageTitle|setupChannelsPageTitle|platformPageTitle) as generateMetadata \} from "#shell\/page-title\.ts";/u.test(
          readFileSync(`${app}/${page}`, "utf-8")
        )
    );

    expect(pages.length).toBeGreaterThan(40);
    expect(untitled).toStrictEqual([]);
  });
});
