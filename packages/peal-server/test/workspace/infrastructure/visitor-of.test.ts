// The visitor a sign-up links to the new account: the id inside the site's
// cookie, as posthog-js writes it once a visitor allowed it, and only when
// it is a version 7 UUID, which no account's or workspace's id ever is.
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import type { Schema } from "effect";

import { visitorOf } from "#workspace/infrastructure/auth/visitor-of.ts";

const token = "phc_synthetic";

const visitorId = "019a9c4e-7b21-7d3f-9a4b-5c6d7e8f9a0b";

// What posthog-js 1.450.0 keeps in `ph_<token>_posthog` with
// `persistence: "cookie"`: its state as JSON, URL-encoded
// (`cookieStore._set` in lib/src/storage.js), the ids its uuidv7 makes,
// in lowercase.
const state = (distinctId: string) => ({
  $device_id: distinctId,
  $epp: true,
  $initial_person_info: { r: "$direct", u: "https://peal.example.test/" },
  $sesid: [
    1_763_557_200_000,
    "019a9c4e-7b22-7a10-8b2c-3d4e5f6a7b8c",
    1_763_557_190_000,
  ],
  $user_state: "anonymous",
  distinct_id: distinctId,
});

const cookieOf = (
  value: typeof Schema.Json.Type,
  name = `ph_${token}_posthog`
) => `${name}=${encodeURIComponent(JSON.stringify(value))}`;

// A browser's cookie header, with the consent answer and a session beside.
const headerWith = (cookie: string) =>
  `peal.consent=allowed.2026-11-19; ${cookie}; peal.session_token=synthetic`;

describe("the visitor a sign-up links", () => {
  it("is the id the site's cookie holds", () => {
    expect(
      visitorOf(headerWith(cookieOf(state(visitorId))), token)
    ).toStrictEqual(Option.some(visitorId));
    expect(visitorOf(cookieOf(state(visitorId)), token)).toStrictEqual(
      Option.some(visitorId)
    );
  });

  it.each([
    ["no cookie header", undefined],
    ["an empty header", ""],
    ["no such cookie", "peal.consent=refused.2026-11-19"],
    // Users' and workspaces' ids are version 4.
    [
      "a version 4 id",
      headerWith(cookieOf(state("6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f"))),
    ],
    [
      "a workspace's service identity",
      headerWith(
        cookieOf(state("workspace:6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f"))
      ),
    ],
    ["an id in capitals", headerWith(cookieOf(state(visitorId.toUpperCase())))],
    // What the SDK names a visitor it counts without a cookie.
    [
      "the cookieless sentinel",
      headerWith(cookieOf(state("$posthog_cookieless"))),
    ],
    ["broken JSON", headerWith(`ph_${token}_posthog=%7B%22distinct_id%22`)],
    ["a broken encoding", headerWith(`ph_${token}_posthog=%E0%A4%A`)],
    ["no id", headerWith(cookieOf({ $user_state: "anonymous" }))],
    ["an id that is no string", headerWith(cookieOf({ distinct_id: 7 }))],
    [
      "another project's cookie",
      headerWith(cookieOf(state(visitorId), "ph_phc_another_posthog")),
    ],
  ])("is none for %s", (_, header) => {
    expect(visitorOf(header, token)).toStrictEqual(Option.none());
  });
});
