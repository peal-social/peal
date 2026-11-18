// How the page's mode drives the SDK, on a fake that records each call:
// what starts it, what switches it in place, what stops a recording.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { identifiedConfigOf } from "#measurement/options.ts";
import type { MeasurementSdk } from "#measurement/sdk.ts";
import { applyState, notStarted, signedOut } from "#measurement/session.ts";
import type { Applied, Wanted } from "#measurement/session.ts";

const userId = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
const workspaceId = "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70";

const session = {
  beforeSend: () => null,
  environment: "test",
  hostname: "app.peal.test",
  token: "phc_synthetic",
  userId,
};

// A fake SDK that records each call by name, with its arguments.
const recorded = () => {
  const calls: (readonly [string, ...unknown[]])[] = [];

  const record =
    (name: string) =>
    (...args: readonly unknown[]) => {
      calls.push([name, ...args]);
    };

  const sdk: MeasurementSdk = {
    captureException: record("captureException"),
    get_session_id: () => "019a7b2c-0000-7000-8000-000000000003",
    group: record("group"),
    identify: record("identify"),
    init: record("init"),
    register: record("register"),
    reset: record("reset"),
    resetGroups: record("resetGroups"),
    set_config: record("set_config"),
    startSessionRecording: record("startSessionRecording"),
    stopSessionRecording: record("stopSessionRecording"),
    unregister: record("unregister"),
  };

  return { calls, sdk };
};

const names = (calls: readonly (readonly [string, ...unknown[]])[]) =>
  calls.map(([name]) => name);

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
const after = (steps: readonly Wanted[], last: Wanted) => {
  const { calls, sdk } = recorded();

  let applied: Applied = notStarted;

  for (const wanted of steps) {
    applied = applyState(sdk, session, applied, wanted);
  }

  calls.length = 0;

  const now = applyState(sdk, session, applied, last);

  return { calls, now };
};

describe(applyState, () => {
  it("starts nothing while the page is off", () => {
    const { calls, now } = after([], personal("off"));

    expect(calls).toStrictEqual([]);
    expect(now).toStrictEqual(notStarted);
  });

  it("starts anonymous: in memory, no person, no group, no recording", () => {
    const { calls } = after([], inWorkspace("anonymous"));

    expect(names(calls)).toStrictEqual(["init", "register"]);
    expect(calls[0]?.[1]).toBe("phc_synthetic");
    expect(calls[0]?.[2]).toMatchObject({
      disable_session_recording: true,
      persistence: "memory",
      tracing_headers: [],
    });
    expect(calls[1]).toStrictEqual(["register", common]);
  });

  it("starts identified with the person's id alone, then the workspace", () => {
    const { calls } = after([], inWorkspace("identified"));

    expect(calls).toStrictEqual([
      [
        "init",
        "phc_synthetic",
        expect.objectContaining({ persistence: "localStorage" }),
      ],
      ["register", common],
      ["identify", userId],
      ["group", "workspace", workspaceId],
      ["register", { workspace_id: workspaceId }],
    ]);
  });

  it("switches in place once the person allows it", () => {
    const { calls } = after([personal("anonymous")], personal("identified"));

    expect(calls).toStrictEqual([
      ["set_config", identifiedConfigOf("app.peal.test")],
      ["identify", userId],
      ["startSessionRecording"],
    ]);
  });

  it("stops, forgets and goes back to memory once withdrawn", () => {
    const { calls } = after([inWorkspace("identified")], personal("anonymous"));

    expect(calls).toStrictEqual([
      ["stopSessionRecording"],
      ["reset"],
      [
        "set_config",
        {
          disable_session_recording: true,
          persistence: "memory",
          tracing_headers: [],
        },
      ],
      ["register", common],
    ]);
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

  it("stops the recording off the measured pages, and starts it again on coming back", () => {
    const leaving = after([inWorkspace("identified")], personal("off"));

    expect(leaving.calls).toStrictEqual([["stopSessionRecording"]]);

    const back = after(
      [inWorkspace("identified"), personal("off")],
      inWorkspace("identified")
    );

    expect(back.calls).toStrictEqual([["startSessionRecording"]]);
  });

  it("never identifies, groups nor records an anonymous page", () => {
    const { calls } = after(
      [personal("anonymous"), personal("off")],
      inWorkspace("anonymous")
    );

    expect(calls).toStrictEqual([]);
  });

  it("calls nothing for the same state again", () => {
    expect(
      after([inWorkspace("identified")], inWorkspace("identified")).calls
    ).toStrictEqual([]);
    expect(
      after([personal("anonymous")], personal("anonymous")).calls
    ).toStrictEqual([]);
  });

  it("forgets the person on signing out", () => {
    const { calls, sdk } = recorded();

    signedOut(sdk);

    expect(calls).toStrictEqual([["reset"]]);
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
