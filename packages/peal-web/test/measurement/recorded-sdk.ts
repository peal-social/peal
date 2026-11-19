// A fake of the SDK the web app uses, which records each call by name with
// its arguments: a new one for each test, never shared through the module.
import type { MeasurementSdk, SdkOptions } from "#measurement/sdk.ts";

/** A call the fake received: its name, then its arguments. */
export type RecordedCall = readonly [string, ...unknown[]];

/** A fake SDK, and the calls it received so far. */
export const recordedSdk = (
  stored = "019a7b2c-0000-7000-8000-00000000000a"
) => {
  const calls: RecordedCall[] = [];
  // What each start was given, the `before_send` it keeps among them.
  const started: SdkOptions[] = [];

  const record =
    (name: string) =>
    (...args: readonly unknown[]) => {
      calls.push([name, ...args]);
    };

  const sdk: MeasurementSdk = {
    captureException: record("captureException"),
    clearStorage: record("clearStorage"),
    // What the browser's storage held when the SDK started: an anonymous
    // id unless a test names another.
    get_distinct_id: () => stored,
    get_session_id: () => "019a7b2c-0000-7000-8000-000000000003",
    group: record("group"),
    identify: record("identify"),
    init: (token, options) => {
      calls.push(["init", token, options]);
      started.push(options);
    },
    register: record("register"),
    reset: record("reset"),
    resetGroups: record("resetGroups"),
    set_config: record("set_config"),
    startSessionRecording: record("startSessionRecording"),
    stopSessionRecording: record("stopSessionRecording"),
    unregister: record("unregister"),
  };

  return { calls, sdk, started };
};
