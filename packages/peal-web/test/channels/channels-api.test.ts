import { describe, expect, it } from "@effect/vitest";
import { DateTime, Exit, Option } from "effect";
import {
  ChannelNotFound,
  ChatConnectLimited,
  ChatNotConnected,
  ConnectFailed,
  Forbidden,
  PlanLimitReached,
  PlatformUnreachable,
  UsageAllowanceReached,
} from "peal-contract";

import { failureOf } from "#channels/channels-api.ts";

describe(failureOf, () => {
  it("is none when the action worked", () => {
    expect(failureOf(Exit.succeed("done"))).toStrictEqual(Option.none());
  });

  it.each([
    [new ConnectFailed({ reason: "invalidInstance" }), "invalidInstance"],
    [new ConnectFailed({ reason: "accountMismatch" }), "accountMismatch"],
    [new ConnectFailed({ reason: "noAccounts" }), "noAccounts"],
    [new PlatformUnreachable(), "unreachable"],
    [new Forbidden(), "forbidden"],
    [new ChannelNotFound(), "notFound"],
    [
      new PlanLimitReached({
        allowed: 3,
        billingUrl: "https://peal.example/app/w/billing",
        limit: "channels",
        plan: "free",
        planWithRoom: "starter",
        used: 3,
      }),
      "planLimit",
    ],
  ])("explains %o", (failure, key) => {
    expect(failureOf(Exit.fail(failure))).toStrictEqual(Option.some(key));
  });

  it.each([
    ["paymentMethodRequired", "xPaymentMethod"],
    ["paymentFailed", "xPaymentFailed"],
    ["planAllowance", "xPerAccountPricing"],
  ] as const)("explains X refused for %s in its own words", (reason, key) => {
    const refused = new UsageAllowanceReached({
      allowed: 0,
      billingUrl: "https://peal.example/app/w/billing",
      meter: "xApi",
      reason,
      resetsAt: DateTime.makeUnsafe("2026-12-01T00:00:00Z"),
      used: 0,
    });

    expect(failureOf(Exit.fail(refused))).toStrictEqual(Option.some(key));
  });

  it.each([
    ["addressNotAWebhook"],
    ["webhookNotFound"],
    ["webhookKindNotSupported"],
    ["credentialsRefused"],
    ["chatNotFound"],
    ["chatKindNotSupported"],
    ["cannotPost"],
  ] as const)(
    "explains a chat refused for %s, apart from websites",
    (reason) => {
      expect(
        failureOf(Exit.fail(new ChatNotConnected({ reason })))
      ).toStrictEqual(Option.some(`chat.${reason}`));
    }
  );

  it("explains too many tries at chats in their own words", () => {
    expect(failureOf(Exit.fail(new ChatConnectLimited()))).toStrictEqual(
      Option.some("chatTooManyTries")
    );
  });

  it("calls anything else, as a server that is down, unknown", () => {
    expect(failureOf(Exit.die(new Error("offline")))).toStrictEqual(
      Option.some("unknown")
    );
  });
});
