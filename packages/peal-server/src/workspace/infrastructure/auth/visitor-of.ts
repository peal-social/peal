import { Option, Schema } from "effect";

import { Uuid7Schema } from "#shared/domain/ids.ts";

// What posthog-js keeps in its cookie once a visitor allowed it: its
// state as JSON, of which only the visitor's id is read.
const decodeState = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ distinct_id: Uuid7Schema }))
);

// A cookie's value, URL-decoded: none when its encoding is broken.
const decoded = (value: string): Option.Option<string> => {
  try {
    return Option.some(decodeURIComponent(value));
  } catch {
    return Option.none();
  }
};

/**
 * The visitor that the site, the docs and the blog followed, from a
 * request's `cookie` header: the `distinct_id` inside the cookie
 * `ph_<token>_posthog` that posthog-js writes once a visitor allowed it
 * (URL-encoded JSON), only when it is a version 7 UUID, as the SDK makes
 * them. Users' and workspaces' ids are version 4, so neither an account's
 * id nor a workspace's service identity (`workspace:<id>`) is ever one.
 * None for anything else.
 */
export const visitorOf = (
  cookieHeader: string | null | undefined,
  token: string
): Option.Option<string> => {
  const prefix = `ph_${token}_posthog=`;

  return Option.fromNullishOr(
    (cookieHeader ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(prefix))
  ).pipe(
    Option.flatMap((cookie) => decoded(cookie.slice(prefix.length))),
    Option.flatMap(decodeState),
    Option.map(({ distinct_id: id }) => id)
  );
};
