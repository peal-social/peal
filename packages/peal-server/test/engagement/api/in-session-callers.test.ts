import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

// A message is a person's own, which Meta's Human Agent tag may carry,
// only when the API's handler saw the member's own session: nothing else
// in the server, no job, cron, rule, automation or tool, may tell
// `EngagementMessages.send` it was `inSession`.

const sources = path.join(import.meta.dirname, "..", "..", "..", "src");

// The one place that vouches for a session, and the use case that reads it.
const allowed = new Set([
  path.join("engagement", "api", "inbox-messages.ts"),
  path.join("engagement", "application", "engagement-messages.ts"),
]);

const filesUnder = (folder: string): readonly string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

describe("who says a message was written in a session", () => {
  it("is the API's sendMessage handler alone", () => {
    const sayers = filesUnder(sources)
      .filter((file) => /\binSession\b/u.test(readFileSync(file, "utf-8")))
      .map((file) => path.relative(sources, file))
      .filter((file) => !allowed.has(file));

    expect(sayers).toStrictEqual([]);
  });

  it("is said once in the handler, from the session principal", () => {
    const handler = readFileSync(
      path.join(sources, "engagement", "api", "inbox-messages.ts"),
      "utf-8"
    );

    expect(handler.match(/\binSession\b/gu)).toStrictEqual(["inSession"]);
    expect(handler).toContain("{ inSession: inOwnSession(member) }");
  });
});
