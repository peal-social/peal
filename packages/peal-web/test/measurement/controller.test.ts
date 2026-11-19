// The measurement's holder through a page load: what a page asks, what
// leaving the app sets aside, what a remount and another person find, and
// what a load that fails leaves.
import { describe, expect, it } from "@effect/vitest";

import { makeController } from "#measurement/controller.ts";
import type { Asked } from "#measurement/controller.ts";
import type { MeasuredEvent } from "#measurement/sanitize.ts";

import { recordedSdk } from "./recorded-sdk.ts";

const userId = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
const otherId = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0db4";

const askedBy = (person: string, mode: Asked["wanted"]["mode"]): Asked => ({
  session: {
    environment: "test",
    hostname: "app.peal.test",
    origin: "https://app.peal.test",
    token: "phc_synthetic",
    userId: person,
  },
  wanted: { mode, workspaceId: null },
});

const pageView = (distinctId: string): MeasuredEvent => ({
  event: "$pageview",
  properties: { distinct_id: distinctId, token: "phc_synthetic" },
  uuid: "019a7b2c-0000-7000-8000-000000000005",
});

// A controller over a fake SDK, with the `before_send` it was started with.
const controlled = () => {
  const { calls, sdk, started } = recordedSdk();
  let loads = 0;

  const controller = makeController(async () => {
    loads += 1;

    return await Promise.resolve(sdk);
  });

  const beforeSend = (event: MeasuredEvent) =>
    started[0]?.before_send(event) ?? null;

  return { beforeSend, calls, controller, loads: () => loads };
};

describe(makeController, () => {
  it("loads nothing while every page is off", async () => {
    const { controller, loads } = controlled();

    await controller.ask(askedBy(userId, "off"));

    expect(loads()).toBe(0);
    expect(controller.sdk()).toBeNull();
  });

  it("measures again after a remount, with the before_send it started with", async () => {
    const { beforeSend, calls, controller, loads } = controlled();

    await controller.ask(askedBy(userId, "anonymous"));
    // The layout unmounts (the staff console, another language) and
    // mounts again: the SDK, started once, is not started again.
    controller.park();

    expect(beforeSend(pageView("anonymous-id"))).toBeNull();

    await controller.ask(askedBy(userId, "anonymous"));

    expect(loads()).toBe(1);
    expect(calls.filter(([name]) => name === "init")).toHaveLength(1);
    expect(beforeSend(pageView("anonymous-id"))).not.toBeNull();
  });

  it("sets an identified SDK aside on leaving the app, tracing headers off", async () => {
    const { calls, controller } = controlled();

    await controller.ask(askedBy(userId, "identified"));
    calls.length = 0;
    controller.park();

    expect(calls.map(([name]) => name)).toStrictEqual([
      "stopSessionRecording",
      "set_config",
      "clearStorage",
    ]);
    expect(calls[1]?.[1]).toMatchObject({
      persistence: "memory",
      tracing_headers: [],
    });
  });

  it("forgets the first person before measuring the next in the same tab", async () => {
    const { beforeSend, calls, controller } = controlled();

    await controller.ask(askedBy(userId, "identified"));
    controller.park();
    calls.length = 0;
    await controller.ask(askedBy(otherId, "anonymous"));

    expect(calls).toContainEqual(["reset", true]);
    expect(calls).toContainEqual(["clearStorage"]);
    expect(calls).not.toContainEqual(["identify", otherId]);
    // The second person, anonymous, is never named.
    expect(beforeSend(pageView(otherId))).toBeNull();
  });

  it("forgets the person on signing out, and measures nothing until asked again", async () => {
    const { beforeSend, calls, controller } = controlled();

    await controller.ask(askedBy(userId, "identified"));
    calls.length = 0;
    controller.signOut();

    expect(calls).toContainEqual(["reset", true]);
    expect(beforeSend(pageView("anonymous-id"))).toBeNull();
  });

  it("names the session to the app's requests only while identified", async () => {
    const { controller } = controlled();

    expect(controller.session()).toBeNull();

    await controller.ask(askedBy(userId, "anonymous"));

    expect(controller.session()).toBeNull();

    await controller.ask(askedBy(userId, "identified"));

    expect(controller.session()).toBe("019a7b2c-0000-7000-8000-000000000003");

    controller.park();

    expect(controller.session()).toBeNull();
  });

  it("stays unmeasured when the SDK cannot load, and tries again later", async () => {
    let attempts = 0;
    const { sdk } = recordedSdk();

    const controller = makeController(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("The chunk could not be fetched");
      }

      return await Promise.resolve(sdk);
    });

    await controller.ask(askedBy(userId, "anonymous"));

    expect(controller.sdk()).toBeNull();

    await controller.ask(askedBy(userId, "anonymous"));

    expect(controller.sdk()).toBe(sdk);
  });

  it("starts nothing for a person who signed out while the SDK loaded", async () => {
    const { calls, controller } = controlled();

    const loading = controller.ask(askedBy(userId, "identified"));

    controller.signOut();
    await loading;

    expect(calls).toStrictEqual([]);
  });

  it("applies the latest ask once loaded, and none when the app was left meanwhile", async () => {
    const { calls, controller } = controlled();

    const loading = controller.ask(askedBy(userId, "anonymous"));

    controller.park();
    await loading;

    expect(calls).toStrictEqual([]);
  });
});
