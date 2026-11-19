import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  campaignOf,
  keptProperties,
  recomputedProperties,
  sanitized,
} from "../src/lib/site/measurement/sanitize";
import type { SiteEvent } from "../src/lib/site/measurement/sanitize";

const page = {
  host: "peal.social",
  origin: "https://peal.social",
  pathname: "/pricing",
  referrer: "https://news.example.com/item?id=42&user=someone",
  search:
    "?email=someone%40example.com&token=synthetic&utm_source=Newsletter&utm_medium=email&utm_campaign=launch%20day&utm_content=x&gclid=synthetic",
};

const common = {
  environment: "production",
  locale: "en",
  source: "site",
} as const;

// A page view as posthog-js 1.450 builds it, with what it may read.
const pageView = (): SiteEvent => ({
  $set: { $browser: "Chrome", email: "someone@example.com" },
  $set_once: { $initial_current_url: "https://peal.social/?email=x" },
  event: "$pageview",
  properties: {
    $browser: "Chrome",
    $browser_version: 142,
    $cookieless_mode: true,
    $current_url:
      "https://peal.social/pricing?email=someone%40example.com&token=synthetic#top",
    $device_id: "019a0000-0000-7000-8000-000000000001",
    $device_type: "Desktop",
    $host: "peal.social",
    $initial_referrer: "https://news.example.com/item?id=42",
    $ip: "203.0.113.7",
    $lib: "web",
    $lib_version: "1.450.0",
    $os: "Mac OS X",
    $pageview_id: "019a0000-0000-7000-8000-000000000002",
    $pathname: "/pricing",
    $referrer: "https://news.example.com/item?id=42&user=someone",
    $referring_domain: "news.example.com",
    $screen_height: 900,
    $screen_width: 1440,
    $session_id: "019a0000-0000-7000-8000-000000000003",
    $window_id: "019a0000-0000-7000-8000-000000000004",
    distinct_id: "$posthog_cookieless",
    title: "Pricing for someone@example.com",
    token: "phc_synthetic",
    utm_content: "x",
  },
  timestamp: new Date("2026-11-19T10:00:00Z"),
  uuid: "019a0000-0000-7000-8000-000000000005",
});

describe("what leaves the site", () => {
  it("is a page view with its address and origin only, never its query", () => {
    const sent = sanitized(pageView(), page, common);

    expect(sent).toStrictEqual({
      event: "$pageview",
      properties: {
        $browser: "Chrome",
        $browser_version: 142,
        $cookieless_mode: true,
        $current_url: "https://peal.social/pricing",
        $device_id: "019a0000-0000-7000-8000-000000000001",
        $device_type: "Desktop",
        $geoip_disable: true,
        $host: "peal.social",
        $lib: "web",
        $lib_version: "1.450.0",
        $os: "Mac OS X",
        $pathname: "/pricing",
        $referring_domain: "news.example.com",
        $screen_height: 900,
        $screen_width: 1440,
        $session_id: "019a0000-0000-7000-8000-000000000003",
        $window_id: "019a0000-0000-7000-8000-000000000004",
        distinct_id: "$posthog_cookieless",
        environment: "production",
        locale: "en",
        source: "site",
        token: "phc_synthetic",
        utm_medium: "email",
        utm_source: "newsletter",
      },
      timestamp: new Date("2026-11-19T10:00:00Z"),
      uuid: "019a0000-0000-7000-8000-000000000005",
    });
  });

  it("names no person's properties, no title and no referrer", () => {
    const sent = JSON.stringify(sanitized(pageView(), page, common));

    expect(sent).not.toContain("someone");
    expect(sent).not.toContain("$set");
    expect(sent).not.toContain("title");
    expect(sent).not.toContain("item?id");
    expect(sent).not.toContain("$ip");
    expect(sent).not.toContain("$initial");
    expect(sent).not.toContain("gclid");
    expect(sent).not.toContain("utm_content");
  });

  it("keeps a referring domain only when it is another site's", () => {
    const own = sanitized(
      pageView(),
      { ...page, referrer: "https://peal.social/docs?q=x" },
      common
    );

    const none = sanitized(pageView(), { ...page, referrer: "" }, common);

    expect(own?.properties["$referring_domain"]).toBeUndefined();
    expect(none?.properties["$referring_domain"]).toBeUndefined();
  });

  it("keeps a campaign label only when it is a short slug", () => {
    expect(
      campaignOf(
        `?utm_source=Newsletter&utm_medium=e%20mail&utm_campaign=${"a".repeat(
          65
        )}`
      )
    ).toStrictEqual({ utm_source: "newsletter" });
    expect(campaignOf("?utm_source=a@b.test")).toStrictEqual({});
  });

  it("drops any event not on the list", () => {
    for (const event of [
      "$autocapture",
      "$identify",
      "$snapshot",
      "$exception",
      "$set",
    ]) {
      expect(sanitized({ ...pageView(), event }, page, common)).toBeNull();
    }
  });
});

// The words the server refuses in a property's key
// (packages/peal-server/src/shared/domain/product-event.ts).
const refusedKeyWords = (): readonly string[] => {
  const source = readFileSync(
    path.join(
      import.meta.dirname,
      "../../peal-server/src/shared/domain/product-event.ts"
    ),
    "utf-8"
  );

  const list =
    /refusedKeyWords[^[]*\[(?<words>[^\]]*)\]/u.exec(source)?.groups?.[
      "words"
    ] ?? "";

  return [...list.matchAll(/"(?<word>[a-z]+)"/gu)].map(
    (match) => match.groups?.["word"] ?? ""
  );
};

describe("the properties the site sends", () => {
  it("read the server's words", () => {
    expect(refusedKeyWords()).toContain("url");
  });

  it("hold none of the words no key may hold, the rewritten address and the token aside", () => {
    const words = new Set(refusedKeyWords());

    // `$current_url` is rewritten from the page, `token` is the project's
    // own, as the web app's test excepts them.
    const excepted = new Set(["$current_url", "token"]);

    const refused = [...keptProperties, ...recomputedProperties].filter(
      (key) =>
        !excepted.has(key) && key.split(/[_$]/u).some((word) => words.has(word))
    );

    expect(refused).toStrictEqual([]);
  });
});
