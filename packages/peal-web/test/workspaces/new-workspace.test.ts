import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  emailSlugTailOf,
  isWorkspaceSlug,
  workspaceSlugOf,
  workspaceSlugWordsOf,
} from "peal-contract/workspace-slug";

import {
  decodeInvitations,
  elidesBefore,
  firstNameOf,
  openInvitationOf,
  slugsToTry,
  slugTaken,
} from "#workspaces/new-workspace.ts";

describe(isWorkspaceSlug, () => {
  it("takes lower-case words, never a personal page, an id or other characters", () => {
    expect(isWorkspaceSlug("maple-studio")).toBeTruthy();
    expect(isWorkspaceSlug("studio2")).toBeTruthy();

    for (const refused of [
      "agenda",
      "account",
      "notices",
      "report",
      "new",
      "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e31",
      "Studio",
      "two words",
      "-studio",
      "studio--two",
      "",
      "a".repeat(49),
    ]) {
      expect(isWorkspaceSlug(refused)).toBeFalsy();
    }
  });
});

describe(workspaceSlugOf, () => {
  it("writes a name's words in ASCII, then the tail", () => {
    expect(workspaceSlugOf("Maxime’s workspace", "1a2b3c4d")).toBe(
      "maximes-workspace-1a2b3c4d"
    );
    expect(workspaceSlugOf("Espace d’Élise", "1a2b3c4d")).toBe(
      "espace-delise-1a2b3c4d"
    );
    expect(workspaceSlugOf("日本", "1a2b3c4d")).toBe("workspace-1a2b3c4d");
    expect(workspaceSlugWordsOf("  Café  Crème! ")).toBe("cafe-creme");
  });

  it("ends a first workspace's slug with the name part of the email address", () => {
    expect(emailSlugTailOf("sam.lee@example.com")).toBe("sam.lee");
    expect(
      workspaceSlugOf(
        "Maxime’s workspace",
        emailSlugTailOf("sam.lee@example.com")
      )
    ).toBe("maximes-workspace-sam-lee");
    expect(
      workspaceSlugOf("Espace d’Élise", emailSlugTailOf("Élise+Pro@example.fr"))
    ).toBe("espace-delise-elise-pro");
    expect(workspaceSlugOf("日本", emailSlugTailOf("@example.com"))).toBe(
      "workspace"
    );
  });

  it("keeps the tail within its own limit, and the slug within 48", () => {
    const slug = workspaceSlugOf(
      `${"long ".repeat(20)}name`,
      emailSlugTailOf(`${"first.last.".repeat(6)}x@example.com`)
    );

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(isWorkspaceSlug(slug)).toBeTruthy();
    expect(slug.startsWith("long-long-")).toBeTruthy();
    expect(slug).toContain("-first-last-");
  });

  it("stays within the limit, cut where a word ends", () => {
    const slug = workspaceSlugOf(`${"long ".repeat(20)}name`, "1a2b3c4d");

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(isWorkspaceSlug(slug)).toBeTruthy();
    expect(slug.endsWith("-1a2b3c4d")).toBeTruthy();
  });
});

describe(slugsToTry, () => {
  it("tries the words alone first, then with the tail", () => {
    expect(slugsToTry("Maple Studio", "1a2b3c4d")).toStrictEqual([
      "maple-studio",
      "maple-studio-1a2b3c4d",
    ]);
  });

  it("goes straight to the tail for a reserved word or a name without words", () => {
    expect(slugsToTry("Agenda", "1a2b3c4d")).toStrictEqual(["agenda-1a2b3c4d"]);
    expect(slugsToTry("!!!", "1a2b3c4d")).toStrictEqual(["workspace-1a2b3c4d"]);
  });

  it("knows Better Auth's answers for a slug another workspace holds", () => {
    expect(slugTaken("ORGANIZATION_ALREADY_EXISTS")).toBeTruthy();
    expect(slugTaken("ORGANIZATION_SLUG_ALREADY_TAKEN")).toBeTruthy();
    expect(slugTaken("FREE_WORKSPACE_LIMIT_REACHED")).toBeFalsy();
  });
});

describe(firstNameOf, () => {
  it("takes the first word of a name", () => {
    expect(firstNameOf("  Ada   Lovelace ")).toBe("Ada");
    expect(firstNameOf("   ")).toBeNull();
  });

  it("tells when French elides de", () => {
    expect(elidesBefore("Alice")).toBeTruthy();
    expect(elidesBefore("Élise")).toBeTruthy();
    expect(elidesBefore("Hugo")).toBeTruthy();
    expect(elidesBefore("Maxime")).toBeFalsy();
  });
});

describe(openInvitationOf, () => {
  const now = new Date("2026-11-19T12:00:00Z");

  it("finds an invitation still open", () => {
    const listed = decodeInvitations([
      { expiresAt: "2026-11-20T12:00:00Z", id: "taken", status: "accepted" },
      { expiresAt: "2026-11-18T12:00:00Z", id: "old", status: "pending" },
      {
        expiresAt: new Date("2026-11-21T12:00:00Z"),
        id: "open",
        status: "pending",
      },
    ]).pipe(Option.getOrThrow);

    expect(openInvitationOf(listed, now)).toBe("open");
    expect(openInvitationOf([], now)).toBeNull();
  });

  it("reads nothing from a malformed list", () => {
    expect(Option.isNone(decodeInvitations(null))).toBeTruthy();
    expect(Option.isNone(decodeInvitations([{ id: 1 }]))).toBeTruthy();
  });
});
