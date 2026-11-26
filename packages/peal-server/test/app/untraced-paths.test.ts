import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  isUntraced,
  loggedPathOf,
  redactedQueryNames,
} from "#app/untraced-paths.ts";

// The query parameters the tracer writes as `<redacted>`: each approves or
// proves something on its own.
describe("the query parameters the tracer redacts", () => {
  it("redacts the device sign-in's code and the tokens addresses carry", () => {
    expect(redactedQueryNames).toStrictEqual(
      expect.arrayContaining(["code", "state", "token", "user_code"])
    );
  });

  it("redacts a post's external id, the caller's content", () => {
    expect(redactedQueryNames).toContain("externalId");
  });
});

// The paths the HTTP tracer leaves out: what their address holds is a
// visitor's (a short link's redirect) or a capability (the digest's
// unsubscribe token), which `url.full` would keep in the traces, or the
// request itself says something of a reader (an email's picture).
describe(isUntraced, () => {
  it("leaves out short links and the digest's unsubscribe links", () => {
    expect(isUntraced("/api/l/abc123")).toBeTruthy();
    expect(
      isUntraced(
        "/api/notifications/weekly-digest/unsubscribe/6c1d9e0a-2b3f-4a5c-8d7e-9f0a1b2c3d4e.0.tag"
      )
    ).toBeTruthy();
  });

  it("leaves out a password reset's link, whose last segment is its token", () => {
    expect(
      isUntraced("/api/auth/reset-password/synthetic-reset-token?callbackURL=x")
    ).toBeTruthy();
    // The reset itself carries its token in its body.
    expect(isUntraced("/api/auth/reset-password")).toBeFalsy();
  });

  it("leaves out the emails' pictures, whose requests would say an email was opened", () => {
    expect(isUntraced("/api/email-assets/header.png")).toBeTruthy();
    expect(isUntraced("/api/email-assets/mark.png?x=1")).toBeTruthy();
  });

  it("traces everything else", () => {
    expect(isUntraced("/api/me/notification-preferences")).toBeFalsy();
    expect(isUntraced("/api/health")).toBeFalsy();
    expect(isUntraced("/api/lookups")).toBeFalsy();
  });
});

// What the request log writes of a path whose last segment is a token.
describe(loggedPathOf, () => {
  it("writes the token's place, never the token", () => {
    expect(
      loggedPathOf(
        "/api/notifications/weekly-digest/unsubscribe/synthetic-token?x=1"
      )
    ).toStrictEqual(
      Option.some("/api/notifications/weekly-digest/unsubscribe/<redacted>")
    );
    expect(
      loggedPathOf("/api/auth/reset-password/synthetic-token?callbackURL=x")
    ).toStrictEqual(Option.some("/api/auth/reset-password/<redacted>"));
  });

  it("leaves any other path as it is", () => {
    expect(loggedPathOf("/api/l/abc123")).toStrictEqual(Option.none());
    expect(loggedPathOf("/api/auth/reset-password")).toStrictEqual(
      Option.none()
    );
  });
});
