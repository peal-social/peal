// The session the app's own requests name to Peal's API, which the
// measurement sets while it runs and takes back when it stops.
import { describe, expect, it } from "@effect/vitest";

import { namedSession, nameSessionWith } from "#measurement/session-header.ts";

describe(nameSessionWith, () => {
  it("names the session until taken back, and nothing after", () => {
    const stop = nameSessionWith(() => "019a7b2c-0000-7000-8000-000000000003");

    expect(namedSession()).toBe("019a7b2c-0000-7000-8000-000000000003");

    stop();

    expect(namedSession()).toBeNull();
  });

  it("leaves a later measurement's name when an earlier one stops", () => {
    const first = nameSessionWith(() => "first");
    const second = nameSessionWith(() => "second");

    first();

    expect(namedSession()).toBe("second");

    second();

    expect(namedSession()).toBeNull();
  });
});
