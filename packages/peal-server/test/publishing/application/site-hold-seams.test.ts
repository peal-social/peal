import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

// A post's websites follow it wherever its job is started or stopped
// (`followOnSites`, `#publishing/application/site-holds.ts`): a use case
// that schedules, moves, takes back or cancels a post without it leaves a
// site holding what the post no longer says. This reads publishing's use
// cases and fails on a function that starts or stops a post's job, or
// deletes a target, without making its sites follow.

const application = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "src",
  "publishing",
  "application"
);

// What starts or stops a post's job, or deletes a target's row.
const seams = [
  /scheduler\.schedule\(/u,
  /scheduler\.cancel\b/u,
  /\bstartJob\(/u,
  /\bstopJob\(/u,
  /posts\.setTargets\(/u,
  /posts\.remove\(/u,
];

// What makes the post's sites follow it.
const follows = [
  /\bfollowOnSites\(/u,
  /\bfollowGone\(/u,
  /\bfollow\(/u,
  /\bleaving\(/u,
  /\bbackToDraft\(/u,
  /\bsaveBackToDraft\(/u,
];

// The functions that may, each with why.
const allowed = {
  // Erasing a workspace calls no site, by the owner's decision: what a
  // site holds stays there, and a hand-over's job finds its target gone.
  "PostRecords.eraseWorkspace": "erasure makes no call of its own",
  // The helpers themselves, which their callers follow beside.
  "PostScheduling.startJob": "the job's start, followed where it is called",
  // A library file's removal from drafts rewrites their targets' options
  // (`detach`, which follows it in the file), keeping every target.
  "MediaInPosts.lockedDrafts": "keeps every target",
} satisfies Readonly<Record<string, string>>;

// Each function of a file named by `Effect.fn("…")`, with its text up to
// the next one.
const functionsOf = (source: string) => {
  const starts = [...source.matchAll(/Effect\.fn\("(?<name>[A-Za-z.]+)"\)/gu)];

  return starts.map((start, index) => ({
    body: source.slice(start.index, starts[index + 1]?.index ?? source.length),
    name: start.groups?.["name"] ?? "",
  }));
};

const sourcesOf = async (folder: string): Promise<readonly string[]> => {
  const entries = await readdir(folder, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const at = path.join(folder, entry.name);

      if (entry.isDirectory()) {
        return await sourcesOf(at);
      }

      return entry.name.endsWith(".ts") ? [at] : [];
    })
  );

  return nested.flat();
};

describe("starting or stopping a post's job", () => {
  it("always makes the post's websites follow it", async () => {
    const files = await sourcesOf(application);

    const sources = await Promise.all(
      files.map(async (file) => ({
        file,
        source: await readFile(file, "utf-8"),
      }))
    );

    const unfollowed: string[] = [];
    const found: string[] = [];

    for (const { file, source } of sources) {
      for (const { body, name } of functionsOf(source)) {
        if (!seams.some((seam) => seam.test(body))) {
          continue;
        }

        found.push(name);

        if (
          !Object.hasOwn(allowed, name) &&
          !follows.some((follow) => follow.test(body))
        ) {
          unfollowed.push(`${path.basename(file)}: ${name}`);
        }
      }
    }

    expect(unfollowed).toStrictEqual([]);
    // The seams the plan names are all read.
    expect(found).toStrictEqual(
      expect.arrayContaining([
        "PostScheduling.move",
        "PostScheduling.scheduleNew",
        "PostScheduling.unschedule",
        "PostScheduling.cancel",
        "PostScheduling.dropTarget",
        "HeldPosts.release",
        "PostDrafts.discard",
        "Publishing.saveBackToDraft",
      ])
    );
  });
});
