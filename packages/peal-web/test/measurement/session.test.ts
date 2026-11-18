// How the page's mode drives the SDK, on a fake that records each call:
// what starts it, what switches it in place, what forgets a person, what
// sets it aside off the app.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { anonymousConfig, identifiedConfigOf } from "#measurement/options.ts";
import {
  applyState,
  notStarted,
  parked,
  signedOut,
} from "#measurement/session.ts";
import type { Applied, Wanted } from "#measurement/session.ts";

import { recordedSdk } from "./recorded-sdk.ts";

const userId = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
const otherId = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0db4";
const workspaceId = "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70";

const sessionOf = (person: string) => ({
  beforeSend: () => null,
  environment: "test",
  hostname: "app.peal.test",
  origin: "https://app.peal.test",
  token: "phc_synthetic",
  userId: person,
});

const session = sessionOf(userId);

const common = {
  $geoip_disable: true,
  environment: "test",
  source: "web",
};

const personal = (mode: Wanted["mode"]): Wanted => ({
  mode,
  workspaceId: null,
});

const inWorkspace = (mode: Wanted["mode"]): Wanted => ({ mode, workspaceId });

// Applies each wanted state in turn, recording only the last one's calls.
const after = (
  steps: readonly Wanted[],
  last: Wanted,
  lastSession = session
) => {
  const { calls, sdk } = recordedSdk();
  let applied: Applied = notStarted;

  for (const wanted of steps) {
    applied = applyState(sdk, session, applied, wanted);
  }

  calls.length = 0;

  const now = applyState(sdk, lastSession, applied, last);

  return { calls, now };
};

// What forgets everyone the SDK knew, from a recording session.
const forgetting = [
  ["stopSessionRecording"],
  ["reset", true],
  ["set_config", anonymousConfig],
  ["clearStorage"],
  ["register", common],
];

describe(applyState, () => {
  it("starts nothing while the page is off", () => {
    const { calls, now } = after([], personal("off"));

    expect(calls).toStrictEqual([]);
    expect(now).toStrictEqual(notStarted);
  });

  it("starts anonymous: in memory, no person, no group, no recording", () => {
    const { calls } = after([], inWorkspace("anonymous"));

    expect(calls.map(([name]) => name)).toStrictEqual(["init", "register"]);
    expect(calls[0]?.[2]).toMatchObject({
      disable_session_recording: true,
      persistence: "memory",
      tracing_headers: [],
    });
  });

  it("starts identified with the person's id alone, and sets its groups even on a personal page", () => {
    const { calls, sdk } = recordedSdk(userId);

    applyState(sdk, session, notStarted, personal("identified"));

    expect(calls.slice(1)).toStrictEqual([
      ["register", common],
      ["identify", userId],
      ["resetGroups"],
      ["unregister", "workspace_id"],
    ]);
  });

  it("starts identified from a new browser id when the storage held someone else's", () => {
    for (const stored of [otherId, "019a7b2c-0000-7000-8000-00000000000a"]) {
      const { calls, sdk } = recordedSdk(stored);

      applyState(sdk, session, notStarted, personal("identified"));

      expect(calls.slice(1, 4)).toStrictEqual([
        ["reset", true],
        ["register", common],
        ["identify", userId],
      ]);
    }
  });

  it("gives each anonymous person in the tab a new browser id", () => {
    const { calls } = after(
      [personal("anonymous")],
      personal("anonymous"),
      sessionOf(otherId)
    );

    expect(calls).toContainEqual(["reset", true]);
    expect(calls).not.toContainEqual(["identify", otherId]);
  });

  it("gives the person a new browser id before naming them, once they allow it", () => {
    const { calls } = after([personal("anonymous")], personal("identified"));

    expect(calls).toStrictEqual([
      ["reset", true],
      ["set_config", identifiedConfigOf("app.peal.test")],
      ["register", common],
      ["identify", userId],
      ["startSessionRecording"],
      ["resetGroups"],
      ["unregister", "workspace_id"],
    ]);
  });

  it("forgets everything, with a new browser id, once withdrawn", () => {
    const { calls } = after([inWorkspace("identified")], personal("anonymous"));

    expect(calls).toStrictEqual(forgetting);
  });

  it("forgets the person before another one signed in this tab", () => {
    const { calls } = after(
      [inWorkspace("identified")],
      personal("anonymous"),
      sessionOf(otherId)
    );

    expect(calls).toStrictEqual(forgetting);
  });

  it("names another person who allowed it only after forgetting the first", () => {
    const { calls } = after(
      [inWorkspace("identified")],
      inWorkspace("identified"),
      sessionOf(otherId)
    );

    expect(calls.map(([name]) => name)).toStrictEqual([
      ...forgetting.map(([name]) => name),
      "reset",
      "set_config",
      "register",
      "identify",
      "startSessionRecording",
      "group",
      "register",
    ]);
    expect(calls).toContainEqual(["identify", otherId]);
  });

  it("names the workspace of an identified page, and none on a personal one", () => {
    const { calls } = after(
      [inWorkspace("identified")],
      personal("identified")
    );

    expect(calls).toStrictEqual([
      ["resetGroups"],
      ["unregister", "workspace_id"],
    ]);
  });

  it("stops the recording on an unmeasured page of the app, and starts it again on coming back", () => {
    expect(
      after([inWorkspace("identified")], personal("off")).calls
    ).toStrictEqual([["stopSessionRecording"]]);
    expect(
      after(
        [inWorkspace("identified"), personal("off")],
        inWorkspace("identified")
      ).calls
    ).toStrictEqual([["startSessionRecording"]]);
  });

  it("never identifies, groups nor records an anonymous page", () => {
    expect(
      after([personal("anonymous"), personal("off")], inWorkspace("anonymous"))
        .calls
    ).toStrictEqual([]);
  });

  it("calls nothing for the same state again", () => {
    expect(
      after([inWorkspace("identified")], inWorkspace("identified")).calls
    ).toStrictEqual([]);
    expect(
      after([personal("anonymous")], personal("anonymous")).calls
    ).toStrictEqual([]);
  });
});

describe(parked, () => {
  it("sets an identified SDK aside, and brings it back as it was", () => {
    const { calls, sdk } = recordedSdk();

    const identified = applyState(
      sdk,
      session,
      notStarted,
      inWorkspace("identified")
    );

    calls.length = 0;

    const aside = parked(sdk, identified);

    expect(calls).toStrictEqual([
      ["stopSessionRecording"],
      ["set_config", anonymousConfig],
      ["clearStorage"],
    ]);

    calls.length = 0;
    applyState(sdk, session, aside, inWorkspace("identified"));

    expect(calls).toStrictEqual([
      ["set_config", identifiedConfigOf("app.peal.test")],
      ["startSessionRecording"],
    ]);
  });

  it("does nothing for an SDK never started, or already aside", () => {
    const { calls, sdk } = recordedSdk();

    expect(parked(sdk, notStarted)).toBe(notStarted);

    const started = applyState(sdk, session, notStarted, personal("anonymous"));

    const aside = parked(sdk, started);

    calls.length = 0;
    parked(sdk, aside);

    expect(calls).toStrictEqual([]);
  });
});

describe(signedOut, () => {
  it("forgets the person, in memory and in the browser, with a new browser id", () => {
    const { calls, sdk } = recordedSdk();

    const identified = applyState(
      sdk,
      session,
      notStarted,
      personal("identified")
    );

    calls.length = 0;

    const out = signedOut(sdk, identified);

    expect(calls).toStrictEqual(forgetting.slice(0, 4));

    // The next person who signs in starts anonymous, with what every
    // event carries again.
    calls.length = 0;
    applyState(sdk, sessionOf(otherId), out, personal("anonymous"));

    expect(calls).toStrictEqual([["register", common]]);
  });
});

// Every file under src/, by its path.
const sources = (folder: string): readonly string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/u.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));

describe("the SDK's package", () => {
  it("is imported by measurement/sdk.ts alone", () => {
    const root = path.join(import.meta.dirname, "../../src");

    const importing = sources(root)
      .filter((file) => /["']posthog-js/u.test(readFileSync(file, "utf-8")))
      .map((file) => path.relative(root, file));

    expect(importing).toStrictEqual([path.join("measurement", "sdk.ts")]);
  });
});
