import { afterEach, describe, expect, it, vi } from "vitest";

import { dayOf } from "../src/lib/site/consent/answer";
import { cookieDomainsOf } from "../src/lib/site/consent/cookies";
import type { SiteEvent } from "../src/lib/site/measurement/sanitize";
import type { SiteSdk, SiteSdkOptions } from "../src/lib/site/measurement/sdk";
import { alignmentOf, daysLeft } from "../src/lib/site/measurement/start";

// startMeasurement in a page made of the few things it reads: a cookie
// jar, two storages, the location and the window's events.

const key = "phc_synthetic";
const visitor = `ph_${key}_posthog`;
const today = dayOf(Date.now());

// A cookie jar as `document.cookie` behaves: a write with a past expiry
// removes the cookie, whatever domain it names.
const jarOf = (initial: Readonly<Record<string, string>>) => {
  const jar = new Map(Object.entries(initial));

  return {
    jar,
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(written: string) {
      const [pair = "", ...attributes] = written.split(";");
      const [name = "", value = ""] = pair.split("=");

      const expires = attributes
        .map((attribute) => attribute.trim())
        .find((attribute) => attribute.toLowerCase().startsWith("expires="));

      const past =
        expires !== undefined &&
        Date.parse(expires.slice("expires=".length)) < Date.now();

      if (past) {
        jar.delete(name.trim());
      } else {
        jar.set(name.trim(), value);
      }
    },
  };
};

// A storage whose keys `Object.keys` lists, as the browser's do.
const storageOf = (keys: readonly string[]) => {
  const storage: Record<string, string> = {};

  for (const name of keys) {
    storage[name] = "1";
  }

  Object.defineProperty(storage, "removeItem", {
    enumerable: false,
    value: (name: string) => {
      Reflect.deleteProperty(storage, name);
    },
  });

  return storage;
};

interface Recorded {
  readonly calls: string[];
  options?: SiteSdkOptions;
  status: "denied" | "granted" | "pending";
  id: string;
}

const sdkOf = (recorded: Recorded): SiteSdk => ({
  capture: (event) => {
    recorded.calls.push(`capture:${event}`);
  },
  get_distinct_id: () => recorded.id,
  get_explicit_consent_status: () => recorded.status,
  init: (_token, options) => {
    recorded.options = options;
  },
  keepSessionSource: () => {
    recorded.calls.push("keepSessionSource");
  },
  opt_in_capturing: () => {
    recorded.calls.push("opt_in");
    recorded.status = "granted";
  },
  opt_out_capturing: () => {
    recorded.calls.push("opt_out");
    recorded.status = "denied";
  },
  // As posthog.reset(true): a new visitor and device, and the SDK's
  // consent forgotten.
  reset: () => {
    recorded.calls.push("reset");
    recorded.id = "019a0000-0000-7000-8000-0000000000ff";
    recorded.status = "pending";
  },
});

const page = (cookies: Readonly<Record<string, string>>) => {
  const browserCookies = jarOf(cookies);
  const events = new EventTarget();
  const reload = vi.fn();
  const local = storageOf([visitor, "peal-docs-code-language"]);
  const session = storageOf([visitor, `ph_${key}_window_id`]);

  vi.stubGlobal("document", {
    addEventListener: events.addEventListener.bind(events),
    documentElement: { lang: "en" },
    get cookie() {
      return browserCookies.cookie;
    },
    set cookie(written: string) {
      browserCookies.cookie = written;
    },
    referrer: "https://news.example.com/item?id=42",
    visibilityState: "visible",
  });
  vi.stubGlobal("window", events);
  vi.stubGlobal("location", {
    host: "peal.social",
    hostname: "peal.social",
    origin: "https://peal.social",
    pathname: "/pricing/",
    protocol: "https:",
    reload,
    search: "?email=someone%40example.com",
  });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);

  return { jar: browserCookies.jar, local, reload, session };
};

const start = async (recorded: Recorded) => {
  // A fresh module, whose one start a page load allows.
  vi.resetModules();

  const { startMeasurement } =
    await import("../src/lib/site/measurement/start");

  await startMeasurement(
    {
      dataset: {
        cookieDomain: "peal.social",
        host: "/pulse/site",
        key,
        source: "site",
      },
    },
    async () => await Promise.resolve(sdkOf(recorded)),
    () => {
      // Web vitals are not measured here.
    }
  );
};

const pageView = (): SiteEvent => ({
  event: "$pageview",
  properties: { distinct_id: "019a0000-0000-7000-8000-000000000001" },
  uuid: "019a0000-0000-7000-8000-000000000002",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("how measurement follows the answer", () => {
  it("follows, forgets or renews as the answer and the cookie say", () => {
    expect(
      alignmentOf({ answer: "allowed", following: false, lostCookie: false })
    ).toBe("follow");
    expect(
      alignmentOf({ answer: "allowed", following: true, lostCookie: false })
    ).toBe("none");
    expect(
      alignmentOf({ answer: "allowed", following: true, lostCookie: true })
    ).toBe("renew");
    expect(
      alignmentOf({ answer: "refused", following: true, lostCookie: false })
    ).toBe("forget");
    expect(
      alignmentOf({ answer: "none", following: true, lostCookie: false })
    ).toBe("forget");
    expect(
      alignmentOf({ answer: "none", following: false, lostCookie: false })
    ).toBe("none");
  });

  it("renews a visitor a sign-up retired, whose cookie a page saved again", () => {
    expect(
      alignmentOf({
        answer: "allowed",
        following: true,
        lostCookie: false,
        retired: true,
      })
    ).toBe("renew");
  });

  it("gives the visitor's cookie no more days than the answer has left", () => {
    expect(daysLeft(today, today)).toBe(183);
    expect(daysLeft(today - 100, today)).toBe(83);
    expect(daysLeft(today - 183, today)).toBe(1);
  });

  it("forgets the visitor wherever the SDK may have set its cookie", () => {
    expect(cookieDomainsOf("docs.peal.social")).toStrictEqual([
      undefined,
      "docs.peal.social",
      "peal.social",
    ]);
    expect(cookieDomainsOf("127.0.0.1")).toStrictEqual([undefined]);
    expect(cookieDomainsOf("localhost")).toStrictEqual([undefined]);
  });
});

describe("startMeasurement", () => {
  it("opts in for an answer that allows it, its cookie no longer than the answer", async () => {
    page({ "peal.consent": `1.a.${String(today - 100)}` });

    const recorded: Recorded = {
      calls: [],
      id: "$posthog_cookieless",
      status: "pending",
    };

    await start(recorded);

    expect(recorded.calls).toContain("opt_in");
    expect(recorded.options?.cookie_expiration).toBe(83);
    expect(recorded.options?.consent_persistence_name).toBe(
      "peal_site_consent"
    );
  });

  it("forgets a visitor whose answer expired, and reloads while the SDK still names them", async () => {
    const { jar, local, reload, session } = page({
      "peal.consent": `1.a.${String(today - 200)}`,
      [visitor]: "%7B%7D",
    });

    const recorded: Recorded = {
      calls: [],
      id: "019a0000-0000-7000-8000-000000000001",
      status: "granted",
    };

    await start(recorded);

    expect(recorded.calls).toContain("opt_out");
    expect(jar.has(visitor)).toBe(false);
    expect(Object.keys(local)).toStrictEqual(["peal-docs-code-language"]);
    expect(Object.keys(session)).toStrictEqual([]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload once the SDK names a new visitor", async () => {
    const { reload } = page({ "peal.consent": `1.r.${String(today)}` });

    const recorded: Recorded = {
      calls: [],
      id: "019a0000-0000-7000-8000-000000000001",
      status: "granted",
    };

    recorded.calls.push = function push(...items: string[]) {
      if (items.includes("opt_out")) {
        recorded.id = "$posthog_cookieless";
      }

      return Array.prototype.push.apply(this, items);
    };

    await start(recorded);

    expect(recorded.calls).toContain("opt_out");
    expect(reload).not.toHaveBeenCalled();
  });

  it("drops an event and renews the visitor once a sign-up removed the cookie", async () => {
    const { jar } = page({
      "peal.consent": `1.a.${String(today)}`,
      [visitor]: "%7B%7D",
    });

    const recorded: Recorded = {
      calls: [],
      id: "019a0000-0000-7000-8000-000000000001",
      status: "granted",
    };

    await start(recorded);

    expect(recorded.options?.before_send(pageView())).not.toBeNull();

    // The server expired it after a sign-up in another tab.
    jar.delete(visitor);

    expect(recorded.options?.before_send(pageView())).toBeNull();

    await Promise.resolve();

    // A new visitor, followed again: the reset's lost consent is restored.
    const afterReset = recorded.calls.slice(recorded.calls.indexOf("reset"));

    expect(afterReset).toContain("opt_in");
    expect(recorded.status).toBe("granted");
    expect(jar.has("peal_site_retired")).toBe(false);
    expect(recorded.options?.before_send(pageView())).not.toBeNull();
  });

  it("removes the retired visitor with the rest on a refusal", async () => {
    const { jar } = page({
      "peal.consent": `1.r.${String(today)}`,
      peal_site_retired: "019a0000-0000-7000-8000-000000000001",
      [visitor]: "%7B%7D",
    });

    await start({
      calls: [],
      id: "$posthog_cookieless",
      status: "granted",
    });

    expect(jar.has("peal_site_retired")).toBe(false);
    expect(jar.has(visitor)).toBe(false);
  });
});
