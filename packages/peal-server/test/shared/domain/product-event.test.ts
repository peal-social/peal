import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  AnalyticsTokenSchema,
  checkedProperties,
  distinctIdOf,
  isDeclaredEvent,
  isDeclaredGroup,
  isDeclaredPerson,
  isSafeProperties,
  userSubject,
  wireProperties,
  workspaceSubject,
} from "#shared/domain/product-event.ts";
import {
  productEventSamples,
  sampleUserId as userId,
  undeclaredEvent,
  undeclaredGroup,
  undeclaredPerson,
  sampleWorkspaceId as workspaceId,
} from "#test/shared/product-event-samples.ts";

const isSafe = isSafeProperties;

describe("the product events", () => {
  it.each(Object.values(productEventSamples))(
    "sends $sample.name with the catalogue's keys",
    ({ keys, sample }) => {
      expect(Object.keys(wireProperties(sample)).toSorted()).toStrictEqual(
        keys
      );
      expect(isSafe(wireProperties(sample))).toBeTruthy();
    }
  );

  it("sends an optional property that is not set as no key", () => {
    expect(
      wireProperties({
        name: "post_published",
        properties: {
          channelId:
            productEventSamples.post_published.sample.properties.channelId,
          postId: productEventSamples.post_published.sample.properties.postId,
          round: 1,
        },
      })
    ).toStrictEqual({
      channel_id:
        productEventSamples.post_published.sample.properties.channelId,
      post_id: productEventSamples.post_published.sample.properties.postId,
      round: 1,
    });
  });
});

describe("the properties that may leave", () => {
  it("takes scalars and one level of objects under PostHog's own keys", () => {
    expect(
      isSafe({
        $geoip_disable: true,
        $groups: { workspace: workspaceId },
        $set: { kind: "service" },
        environment: "production",
        round: 1,
        workspace_id: workspaceId,
      })
    ).toBeTruthy();
  });

  it.each([
    { label: "an email address", value: "someone@example.com" },
    { label: "a sentence", value: "Our new product is out" },
    { label: "a URL with a query", value: "https://example.com/?code=abc" },
    { label: "a NUL", value: "posts\u0000create" },
    { label: "null", value: null },
    { label: "an array", value: ["posts.create"] },
    { label: "an empty string", value: "" },
    { label: "an infinite number", value: Number.POSITIVE_INFINITY },
    { label: "an object outside PostHog's keys", value: { kind: "user" } },
  ])("refuses $label", ({ value }) => {
    expect(isSafe({ operation: value })).toBeFalsy();
    expect(checkedProperties({ operation: value })).toStrictEqual({
      _tag: "unsafe",
      key: "operation",
    });
  });

  it("refuses an object two levels deep", () => {
    expect(isSafe({ $set: { person: { kind: "user" } } })).toBeFalsy();
  });

  it("refuses a key that is not snake_case", () => {
    expect(isSafe({ workspaceId })).toBeFalsy();
    expect(isSafe({ "user agent": "x" })).toBeFalsy();
  });

  it("refuses PostHog's keys but those Peal sets", () => {
    expect(isSafe({ $ip: "127.0.0.1" })).toBeFalsy();
    expect(isSafe({ $current_url: "example.com/path" })).toBeFalsy();
  });

  it("names the key, never the value", () => {
    expect(
      checkedProperties({ ok: true, operation: "someone@example.com" })
    ).toStrictEqual({ _tag: "unsafe", key: "operation" });
  });

  it("bounds a token at 120 characters", () => {
    expect(Schema.is(AnalyticsTokenSchema)("a".repeat(120))).toBeTruthy();
    expect(Schema.is(AnalyticsTokenSchema)("a".repeat(121))).toBeFalsy();
  });
});

describe("the keys that may leave", () => {
  it.each([
    "email",
    "user_email",
    "ip",
    "name",
    "display_name",
    "url",
    "text",
    "token",
  ])("refuses a key naming %s, whatever its value", (key) => {
    expect(isSafe({ [key]: true })).toBeFalsy();
  });

  it("takes the keys the catalogue sends", () => {
    expect(
      isSafe({ $geoip_disable: true, billing_account_id: "x", error_code: "x" })
    ).toBeTruthy();
  });
});

describe("the events and properties the catalogue declares", () => {
  it("takes every event of the catalogue as it is", () => {
    for (const { sample } of Object.values(productEventSamples)) {
      expect(isDeclaredEvent(sample)).toBeTruthy();
    }
  });

  it("refuses an event with a key it does not declare", () => {
    expect(isDeclaredEvent(undeclaredEvent)).toBeFalsy();
    expect(isDeclaredPerson(undeclaredPerson)).toBeFalsy();
    expect(isDeclaredGroup(undeclaredGroup)).toBeFalsy();
  });
});

describe("who an event is about", () => {
  it("is the user's id for a person", () => {
    expect(distinctIdOf(userSubject(userId))).toBe(userId);
  });

  it("is the workspace's service identity otherwise", () => {
    expect(distinctIdOf(workspaceSubject(workspaceId))).toBe(
      `workspace:${workspaceId}`
    );
  });
});
