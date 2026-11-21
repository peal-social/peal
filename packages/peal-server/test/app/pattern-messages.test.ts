// A text the contract refuses by its pattern is told what it expects in
// words, never as the pattern's regular expression.
import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import {
  CalendarDaySchema,
  ClientErrorReportSchema,
  LookupInputSchema,
  NewInvitationSchema,
} from "peal-contract";

const messageOf = <A, I>(schema: Schema.Codec<A, I>, input: Schema.Json) => {
  const decoded = Schema.decodeUnknownResult(schema)(input);

  return Result.isFailure(decoded) ? String(decoded.failure) : "decoded";
};

describe("what a pattern refuses", () => {
  it("says what it expects in words", () => {
    const messages = [
      messageOf(CalendarDaySchema, "21/11/2026"),
      messageOf(ClientErrorReportSchema, {
        digest: null,
        kind: "uncaught",
        message: "Synthetic",
        path: "/app?token=synthetic",
        release: "synthetic",
        route: null,
        stack: null,
        userAgent: null,
      }),
      messageOf(LookupInputSchema, { regionCode: "us" }),
      messageOf(NewInvitationSchema, { email: "nobody", role: "member" }),
    ];

    expect(messages).toStrictEqual([
      expect.stringContaining("Expected a day, as YYYY-MM-DD"),
      expect.stringContaining("Expected a path without a query or a fragment"),
      expect.stringContaining(
        "Expected a country as two capital letters, such as US"
      ),
      expect.stringContaining("Expected an email address"),
    ]);

    for (const message of messages) {
      expect(message).not.toContain("RegExp");
    }
  });
});
