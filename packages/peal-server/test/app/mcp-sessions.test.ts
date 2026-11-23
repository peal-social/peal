// Which sessions of the MCP endpoint's sessionful revisions end: those
// unused for an hour, and those a credential or a person holds past their
// limit, least recently used first. The whole server's are in mcp.test.ts.
import { describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";

import {
  idleSessions,
  ownerOf,
  sessionIdleLimit,
  sessionsPastLimit,
  sessionsPerCredential,
  sessionsPerPerson,
} from "#app/mcp/sessions.ts";
import type { OpenSession, SessionOwner } from "#app/mcp/sessions.ts";

const now = Date.parse("2026-11-23T12:00:00Z");

// A person's credential through one application.
const credentialOf = (person: string, client: string): SessionOwner => ({
  credential: `${person}:${client}:w`,
  person,
});

const session = (
  id: string,
  owner: SessionOwner,
  ago: number
): OpenSession => ({
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
          session("idle", credentialOf("user:a", "one"), limit + 1),
          session("just", credentialOf("user:a", "one"), limit),
          session("used", credentialOf("user:b", "one"), 1000),
        ],
        now
      ).map(({ id }) => id)
    ).toStrictEqual(["idle"]);
  });
});

describe(sessionsPastLimit, () => {
  it("ends a credential's least recently used sessions past its limit, never another application's", () => {
    const mine = credentialOf("user:a", "one");

    const owned = Array.from({ length: sessionsPerCredential + 2 }, (_, at) =>
      session(`own-${String(at)}`, mine, at * 1000)
    );

    expect(
      sessionsPastLimit(
        [
          ...owned,
          // Another application of the same person, unused for longer.
          session("theirs", credentialOf("user:a", "two"), 1_000_000),
          session("key", { credential: "key:b", person: "key:b" }, 1_000_000),
        ],
        mine
      ).map(({ id }) => id)
    ).toStrictEqual([
      `own-${String(sessionsPerCredential + 1)}`,
      `own-${String(sessionsPerCredential)}`,
    ]);
  });

  it("ends a person's least recently used sessions past their total, across applications", () => {
    const sessions = Array.from({ length: sessionsPerPerson + 1 }, (_, at) =>
      session(
        `client-${String(at)}`,
        credentialOf("user:a", `client-${String(at)}`),
        at * 1000
      )
    );

    expect(
      sessionsPastLimit(sessions, credentialOf("user:a", "client-0")).map(
        ({ id }) => id
      )
    ).toStrictEqual([`client-${String(sessionsPerPerson)}`]);
  });

  it("ends nothing within the limits", () => {
    const mine = credentialOf("user:a", "one");

    expect(sessionsPastLimit([session("one", mine, 0)], mine)).toStrictEqual(
      []
    );
  });
});

const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

// A person, through an application, bound to a workspace.
const through = (clientId: string, workspaceId = "w1") =>
  ownerOf(
    {
      _tag: "user",
      impersonatedBy: null,
      oauth: { clientId, scopes: ["workspace:read"], workspaceId },
      userId,
    },
    workspaceId
  );

describe(ownerOf, () => {
  it("gives each application and workspace of a person sessions of its own, counted as the person's", () => {
    expect(through("synthetic-one").credential).not.toBe(
      through("synthetic-two").credential
    );
    expect(through("synthetic-one").credential).not.toBe(
      through("synthetic-one", "w2").credential
    );
    expect(through("synthetic-one").person).toBe(
      through("synthetic-two", "w2").person
    );
  });

  it("gives a key sessions of its own", () => {
    expect(
      ownerOf(
        {
          _tag: "apiKey",
          apiKeyId: "synthetic-key",
          permissions: [],
          workspaceId: "5b0c6e64-5d0f-4a7e-9a52-3f1c2d4e5f60",
        },
        "5b0c6e64-5d0f-4a7e-9a52-3f1c2d4e5f60"
      )
    ).toStrictEqual({
      credential: "key:synthetic-key",
      person: "key:synthetic-key",
    });
  });
});
