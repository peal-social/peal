import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { Billing, PlanAllowances } from "peal-contract";
import { accountsMonthly, rateCard } from "peal-contract/rate-card";

import {
  connectedCount,
  failedCount,
  isDone,
  nextStep,
  recorded,
  runErrorOf,
  runOf,
  startOf,
  stepAfterNext,
} from "#channels/connect-run.ts";
import type { Connectable } from "#components/channels/connect-forms.tsx";
import { platformsNamed } from "#home/setup-config.ts";
import {
  isReady,
  setupCostOf,
  setupOptionsOf,
  stepsOf,
  xNeedsPayment,
} from "#home/setup.ts";

const connectable: Connectable = {
  chats: ["discord", "telegram"],
  instagramConnections: ["unifiedLogin", "facebookLogin"],
  linkedinConnections: ["linkedinProfile", "linkedinPage"],
  platforms: ["x", "linkedin", "bluesky", "mastodon", "instagram", "youtube"],
  sites: ["wordpressCom"],
};

const freeTier: PlanAllowances = {
  assistantRequests: 0,
  channels: 2,
  mediaStorage: 1_000_000_000,
  members: null,
  scheduledPosts: null,
};

// A new workspace on the free tier: nothing connected yet.
const onFree: Billing = {
  accounts: {
    accountDays: 0,
    connected: 0,
    estimate: { amount: 0, currency: "usd" },
    nextAccount: { amount: 0, currency: "usd" },
    pooled: 0,
  },
  allowances: freeTier,
  currency: "eur",
  enabled: true,
  estimate: { amount: 0, currency: "usd" },
  meters: null,
  paymentMethod: false,
  plan: "free",
  plans: [],
  rateCard,
  subscription: null,
  trial: null,
  upcomingInvoice: null,
  usage: {
    assistantRequests: {
      resetsAt: DateTime.makeUnsafe("2026-11-23T00:00:00Z"),
      used: 0,
    },
    channels: 0,
    mediaStorage: 0,
    members: 1,
    scheduledPosts: {
      resetsAt: DateTime.makeUnsafe("2026-12-01T00:00:00Z"),
      used: 0,
    },
  },
  vatRate: 20,
  withdrawableUntil: null,
};

describe(setupOptionsOf, () => {
  it("offers the sign-ins in New channel's order, LinkedIn's two ways apart, no website or chat", () => {
    expect(setupOptionsOf(connectable, []).map(({ key }) => key)).toStrictEqual(
      [
        "mastodon",
        "bluesky",
        "linkedin:linkedinProfile",
        "linkedin:linkedinPage",
        "x",
        "youtube",
        "instagram",
      ]
    );
  });

  it("asks Mastodon for its server and Bluesky for a handle", () => {
    const inputs = new Map(
      setupOptionsOf(connectable, []).map(({ input, key }) => [key, input])
    );

    expect(inputs.get("mastodon")).toBe("instance");
    expect(inputs.get("bluesky")).toBe("handle");
    expect(inputs.get("youtube")).toBeNull();
  });

  it("keeps LinkedIn to one row where the server connects profiles alone", () => {
    const options = setupOptionsOf(
      { ...connectable, linkedinConnections: ["linkedinProfile"] },
      []
    );

    expect(
      options.filter(({ platform }) => platform === "linkedin")
    ).toStrictEqual([
      { connection: null, input: null, key: "linkedin", platform: "linkedin" },
    ]);
  });

  it("leaves out what the operator hides", () => {
    const keys = setupOptionsOf(connectable, ["instagram", "x"]).map(
      ({ key }) => key
    );

    expect(keys).not.toContain("instagram");
    expect(keys).not.toContain("x");
    expect(keys).toContain("youtube");
  });
});

describe("stepsOf and isReady", () => {
  const options = setupOptionsOf(connectable, []);

  it("makes a step of each row ticked, in the card's order, with what was typed", () => {
    expect(
      stepsOf(
        options,
        ["youtube", "linkedin:linkedinPage", "mastodon", "bluesky"],
        {
          bluesky: "  ",
          mastodon: " mastodon.social ",
        }
      )
    ).toStrictEqual([
      { instance: "mastodon.social", platform: "mastodon" },
      { platform: "bluesky" },
      { connection: "linkedinPage", platform: "linkedin" },
      { platform: "youtube" },
    ]);
  });

  it("waits for a tick, and for Mastodon's server", () => {
    expect(isReady(options, [], {})).toBeFalsy();
    expect(isReady(options, ["mastodon"], {})).toBeFalsy();
    expect(
      isReady(options, ["mastodon"], { mastodon: "mastodon.social" })
    ).toBeTruthy();
    expect(isReady(options, ["bluesky"], {})).toBeTruthy();
  });
});

describe(setupCostOf, () => {
  it("says the free accounts while the ticks stay within them", () => {
    expect(setupCostOf(onFree, 2)).toStrictEqual({ _tag: "free", free: 2 });
  });

  it("says a payment method is asked past them", () => {
    expect(setupCostOf(onFree, 3)).toStrictEqual({
      _tag: "needsPayment",
      free: 2,
    });
    expect(
      setupCostOf({ ...onFree, accounts: { ...onFree.accounts, pooled: 2 } }, 1)
    ).toStrictEqual({ _tag: "needsPayment", free: 2 });
  });

  it("says what the accounts add with a payment method, from the rate card", () => {
    const paying: Billing = {
      ...onFree,
      accounts: { ...onFree.accounts, pooled: 2 },
      paymentMethod: true,
      plan: "payAsYouGo",
    };

    const cost = setupCostOf(paying, 3);

    expect(cost?._tag).toBe("adds");
    expect(cost?._tag === "adds" ? cost.price.excluded : null).toBe(
      accountsMonthly(5) - accountsMonthly(2)
    );
  });

  it("says nothing where the server does not bill, or nothing is ticked", () => {
    expect(setupCostOf({ ...onFree, enabled: false }, 3)).toBeNull();
    expect(setupCostOf(onFree, 0)).toBeNull();
  });

  it("closes X without a payment method, only where the server bills", () => {
    expect(xNeedsPayment(onFree)).toBeTruthy();
    expect(xNeedsPayment({ ...onFree, paymentMethod: true })).toBeFalsy();
    expect(xNeedsPayment({ ...onFree, enabled: false })).toBeFalsy();
    expect(xNeedsPayment(null)).toBeFalsy();
  });
});

describe("a run", () => {
  const run = runOf("workspace-1", [
    { instance: "mastodon.social", platform: "mastodon" },
    { platform: "facebook" },
    { platform: "youtube" },
  ]);

  it("goes step by step, keeping each outcome", () => {
    expect(nextStep(run)?.platform).toBe("mastodon");
    expect(stepAfterNext(run)?.platform).toBe("facebook");

    const after = recorded(
      recorded(run, "mastodon", { _tag: "connected", handles: ["@a"] }),
      "facebook",
      { _tag: "connected", handles: ["Page one", "Page two"] }
    );

    expect(connectedCount(after)).toBe(3);

    const done = recorded(after, "youtube", {
      _tag: "failed",
      error: "denied",
    });

    expect(isDone(done)).toBeTruthy();
    expect(failedCount(done)).toBe(1);
  });

  it("ignores a sign-in that is not the next step's", () => {
    expect(recorded(run, "youtube", { _tag: "skipped" })).toBe(run);
  });

  it("starts each step with what it holds but its platform", () => {
    expect(
      startOf({ instance: "mastodon.social", platform: "mastodon" })
    ).toStrictEqual({ instance: "mastodon.social" });
    expect(
      startOf({ connection: "linkedinPage", platform: "linkedin" })
    ).toStrictEqual({ connection: "linkedinPage" });
  });

  it("keeps the refusals it expects, any other as unknown", () => {
    expect(runErrorOf("planLimit")).toBe("planLimit");
    expect(runErrorOf("invalidInstance")).toBe("invalidInstance");
    expect(runErrorOf("chat.credentialsRefused")).toBe("unknown");
  });
});

describe(platformsNamed, () => {
  it("reads the platforms a list names, leaving out other words", () => {
    expect(
      platformsNamed(" facebook, instagram ,threads,,myspace")
    ).toStrictEqual(["facebook", "instagram", "threads"]);
    expect(platformsNamed("")).toStrictEqual([]);
  });
});
