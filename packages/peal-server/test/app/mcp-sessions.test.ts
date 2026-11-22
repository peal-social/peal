// Which sessions of the MCP endpoint's sessionful revisions end: those
// unused for an hour, and those a credential holds past its limit, least
// recently used first. The whole server's are in mcp.test.ts.
import { describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";

import {
  idleSessions,
  ownerOf,
  sessionIdleLimit,
  sessionsPastLimit,
  sessionsPerCredential,
} from "#app/mcp/sessions.ts";
import type { OpenSession } from "#app/mcp/sessions.ts";

const now = Date.parse("2026-11-23T12:00:00Z");

const session = (id: string, owner: string, ago: number): OpenSession => ({
  id,
  lastUsed: now - ago,
  owner,
});

describe(idleSessions, () => {
  it("ends the sessions unused past the limit, and none used since", () => {
    const limit = Duration.toMillis(sessionIdleLimit);

    expect(
      idleSessions(
        [
          session("idle", "user:a", limit + 1),
          session("just", "user:a", limit),
          session("used", "key:b", 1000),
        ],
        now
      ).map(({ id }) => id)
    ).toStrictEqual(["idle"]);
  });
});

describe(sessionsPastLimit, () => {
  it("ends an owner's least recently used sessions past its limit, and nobody else's", () => {
    const owned = Array.from({ length: sessionsPerCredential + 2 }, (_, at) =>
      session(`own-${String(at)}`, "user:a", at * 1000)
    );

    expect(
      sessionsPastLimit(
        [...owned, session("other", "key:b", 1_000_000)],
        "user:a"
      ).map(({ id }) => id)
    ).toStrictEqual([
      `own-${String(sessionsPerCredential + 1)}`,
      `own-${String(sessionsPerCredential)}`,
    ]);
  });

  it("ends nothing within the limit", () => {
    expect(
      sessionsPastLimit([session("one", "user:a", 0)], "user:a")
    ).toStrictEqual([]);
  });
});

// A person, through an application.
const through = (clientId: string) =>
  ownerOf({
    _tag: "user",
    impersonatedBy: null,
    oauth: { clientId, scopes: ["workspace:read"], workspaceId: null },
    userId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  });

describe(ownerOf, () => {
  it("counts a person's sessions together, whichever application opened them", () => {
    expect(through("synthetic-one")).toBe(through("synthetic-two"));
    expect(
      ownerOf({
        _tag: "apiKey",
        apiKeyId: "synthetic-key",
        permissions: [],
        workspaceId: "5b0c6e64-5d0f-4a7e-9a52-3f1c2d4e5f60",
      })
    ).toBe("key:synthetic-key");
  });
});
