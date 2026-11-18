// What leaves the browser: every event through `sanitized`, the SDK's
// `before_send`, which keeps ids, enums, numbers and booleans alone.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import {
  rewrittenOrRequired,
  sanitized,
  sentProperties,
} from "#measurement/sanitize.ts";
import type { MeasuredEvent } from "#measurement/sanitize.ts";

const userId = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
const workspaceId = "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70";
const postId = "019a7b2c-3d4e-7f50-8a1b-2c3d4e5f6a7b";
const anonymousId = "019a7b2c-0000-7000-8000-000000000001";

const anonymous = { mode: "anonymous", userId } as const;
const identified = { mode: "identified", userId } as const;
const off = { mode: "off", userId } as const;

// A page view as posthog-js 1.451 builds it (`calculateEventProperties`,
// browser-common's `getEventProperties`, the page view manager), with a
// few of what may not leave.
const pageView = (distinctId: string): MeasuredEvent => ({
  $set: { email: "someone@example.test" },
  $set_once: { $initial_referrer: "https://example.test/?q=secret" },
  event: "$pageview",
  properties: {
    $browser: "Chrome",
    $browser_language: "fr-FR",
    $browser_version: 142,
    $config_defaults: "2026-08-30",
    $current_url: `https://app.peal.test/fr/app/${workspaceId}/posts/${postId}?token=secret#x`,
    $device_id: anonymousId,
    $device_type: "Desktop",
    $groups: { workspace: workspaceId },
    $host: "app.peal.test",
    $initial_referrer: "https://example.test",
    $insert_id: "x1y2z3",
    $is_identified: false,
    $lib: "web",
    $lib_custom_api_host: "/pulse",
    $lib_version: "1.451.1",
    $os: "Mac OS X",
    $pageview_id: "019a7b2c-0000-7000-8000-000000000002",
    $pathname: `/fr/app/${workspaceId}/posts/${postId}`,
    $prev_pageview_duration: 12.5,
    $prev_pageview_last_content: 3,
    $prev_pageview_pathname: `/app/${workspaceId}`,
    $raw_user_agent: "Mozilla/5.0 (Macintosh)",
    $referrer: "https://example.test/?q=secret",
    $referring_domain: "example.test",
    $screen_height: 1117,
    $screen_width: 1728,
    $session_id: "019a7b2c-0000-7000-8000-000000000003",
    $time: 1_795_000_000,
    $timezone: "Europe/Paris",
    $viewport_height: 900,
    $viewport_width: 1440,
    $window_id: "019a7b2c-0000-7000-8000-000000000004",
    distinct_id: distinctId,
    environment: "test",
    source: "web",
    title: "Synthetic post title",
    token: "phc_synthetic",
    utm_source: "newsletter",
    workspace_id: workspaceId,
  },
  uuid: "019a7b2c-0000-7000-8000-000000000005",
});

describe(sanitized, () => {
  it("sends nothing while the page is off", () => {
    expect(sanitized(pageView(anonymousId), off)).toBeNull();
  });

  it("keeps a page view's ids, enums and numbers, its address as a pattern", () => {
    const sent = sanitized(pageView(userId), identified);

    expect(sent?.properties).toStrictEqual({
      $browser: "Chrome",
      $browser_version: 142,
      $config_defaults: "2026-08-30",
      $current_url: "https://app.peal.test/app/:id/posts/:id",
      $device_id: anonymousId,
      $device_type: "Desktop",
      $groups: { workspace: workspaceId },
      $host: "app.peal.test",
      $insert_id: "x1y2z3",
      $is_identified: false,
      $lib: "web",
      $lib_version: "1.451.1",
      $os: "Mac OS X",
      $pageview_id: "019a7b2c-0000-7000-8000-000000000002",
      $pathname: "/app/:id/posts/:id",
      $prev_pageview_duration: 12.5,
      $prev_pageview_pathname: "/app/:id",
      $screen_height: 1117,
      $screen_width: 1728,
      $session_id: "019a7b2c-0000-7000-8000-000000000003",
      $time: 1_795_000_000,
      $viewport_height: 900,
      $viewport_width: 1440,
      $window_id: "019a7b2c-0000-7000-8000-000000000004",
      distinct_id: userId,
      environment: "test",
      source: "web",
      token: "phc_synthetic",
      workspace_id: workspaceId,
    });
    // The server alone sets a person's properties.
    expect(sent).not.toHaveProperty("$set");
    expect(sent).not.toHaveProperty("$set_once");
  });

  it("names no workspace in an anonymous page view", () => {
    const sent = sanitized(pageView(anonymousId), anonymous);

    expect(sent?.properties).not.toHaveProperty("workspace_id");
    expect(sent?.properties).not.toHaveProperty("$groups");
    expect(sent?.properties["distinct_id"]).toBe(anonymousId);
  });

  it("drops an anonymous event that names the person, a guard against a bug", () => {
    expect(sanitized(pageView(userId), anonymous)).toBeNull();
  });

  it("keeps a recording's data only once the person allowed it", () => {
    const snapshot: MeasuredEvent = {
      event: "$snapshot",
      properties: {
        $snapshot_data: [{ data: {}, type: 2 }],
        distinct_id: userId,
      },
      uuid: "019a7b2c-0000-7000-8000-000000000006",
    };

    expect(sanitized(snapshot, identified)).toBe(snapshot);
    expect(sanitized(snapshot, anonymous)).toBeNull();
    expect(sanitized(snapshot, off)).toBeNull();
  });

  it("names the person once identified, with no property set", () => {
    const identify: MeasuredEvent = {
      $set: { name: "Synthetic person" },
      event: "$identify",
      properties: {
        $anon_distinct_id: anonymousId,
        $set: { email: "someone@example.test" },
        distinct_id: userId,
        token: "phc_synthetic",
      },
      uuid: "019a7b2c-0000-7000-8000-000000000007",
    };

    expect(sanitized(identify, identified)).toStrictEqual({
      event: "$identify",
      properties: {
        $anon_distinct_id: anonymousId,
        distinct_id: userId,
        token: "phc_synthetic",
      },
      uuid: identify.uuid,
    });
    expect(sanitized(identify, anonymous)).toBeNull();
  });

  it("names a workspace's group without its properties", () => {
    const group: MeasuredEvent = {
      event: "$groupidentify",
      properties: {
        $group_key: workspaceId,
        $group_set: { name: "Synthetic studio" },
        $group_type: "workspace",
        distinct_id: userId,
      },
      uuid: "019a7b2c-0000-7000-8000-000000000008",
    };

    expect(
      sanitized(group, identified)?.properties["$group_set"]
    ).toStrictEqual({});
    expect(sanitized(group, anonymous)).toBeNull();
  });

  it("keeps an error as the report was redacted", () => {
    const exception: MeasuredEvent = {
      event: "$exception",
      properties: {
        $exception_level: "error",
        $exception_list: [{ type: "Error", value: "Failed on [id]" }],
        $exception_message: "Failed on [id]",
        $exception_steps: [{ message: "clicked" }],
        distinct_id: anonymousId,
        error_kind: "uncaught",
        release: "synthetic-release",
      },
      uuid: "019a7b2c-0000-7000-8000-000000000009",
    };

    expect(sanitized(exception, anonymous)?.properties).toStrictEqual({
      $exception_level: "error",
      $exception_list: [{ type: "Error", value: "Failed on [id]" }],
      distinct_id: anonymousId,
      error_kind: "uncaught",
      release: "synthetic-release",
    });
  });

  it("leaves out an unknown key, and any event it does not send", () => {
    const event = pageView(anonymousId);

    expect(
      sanitized(
        {
          ...event,
          properties: { ...event.properties, $new_thing: "x" },
        },
        anonymous
      )?.properties
    ).not.toHaveProperty("$new_thing");
    expect(
      sanitized({ ...event, event: "$autocapture" }, identified)
    ).toBeNull();
    expect(sanitized({ ...event, event: "$rageclick" }, identified)).toBeNull();
  });
});

// The server's words no key may hold (peal-server's product-event.ts).
const refusedKeyWords = (): readonly string[] => {
  const source = readFileSync(
    path.join(
      import.meta.dirname,
      "../../../peal-server/src/shared/domain/product-event.ts"
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

describe("the properties the web app sends", () => {
  it("read the server's words", () => {
    expect(refusedKeyWords()).toContain("url");
    expect(refusedKeyWords()).toContain("content");
  });

  it("hold none of the words no key may hold, the rewritten address and the token aside", () => {
    const words = new Set(refusedKeyWords());

    const refused = [...sentProperties].filter(
      (key) =>
        !rewrittenOrRequired.has(key) &&
        key.split(/[_$]/u).some((word) => words.has(word))
    );

    expect(refused).toStrictEqual([]);
  });
});
