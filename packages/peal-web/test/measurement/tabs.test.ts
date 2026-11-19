// What the browser's tabs tell each other, and which choice holds in each.
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { answerNews, consentNow, tabNewsOf } from "#measurement/tabs.ts";
import type { ConsentNow } from "#measurement/tabs.ts";

const undecided = { consent: "undecided", decidedAt: null } as const;

const granted = {
  consent: "granted",
  decidedAt: "2026-11-18T10:00:00.000Z",
} as const;

const refused = {
  consent: "refused",
  decidedAt: "2026-11-18T11:00:00.000Z",
} as const;

describe(consentNow, () => {
  it("takes the choice made here while the server still says what it said then", () => {
    expect(
      consentNow(undecided, { ...granted, over: undecided })
    ).toStrictEqual(granted);
  });

  it("takes the server's once the page read it again", () => {
    // Another tab withdrew, or the choice expired.
    expect(consentNow(refused, { ...granted, over: undecided })).toStrictEqual(
      refused
    );
    expect(consentNow(undecided, null)).toStrictEqual(undecided);
  });
});

describe(tabNewsOf, () => {
  it("reads a choice and a sign-out, and nothing else", () => {
    expect(
      Option.getOrNull(
        tabNewsOf(JSON.stringify({ ...refused, kind: "chosen" }))
      )
    ).toStrictEqual({ ...refused, kind: "chosen" });
    expect(
      Option.getOrNull(tabNewsOf(JSON.stringify({ kind: "signedOut" })))
    ).toStrictEqual({
      kind: "signedOut",
    });
    expect(
      Option.isNone(tabNewsOf(JSON.stringify({ kind: "chosen" })))
    ).toBeTruthy();
  });

  it("reads a sign-in, and nothing that is not news", () => {
    expect(
      Option.getOrNull(tabNewsOf(JSON.stringify({ kind: "signedIn" })))
    ).toStrictEqual({ kind: "signedIn" });
    expect(Option.isNone(tabNewsOf("signedOut"))).toBeTruthy();
    expect(Option.isNone(tabNewsOf(null))).toBeTruthy();
  });
});

// GET /api/me's answer, as far as the measurement reads it.
const answer = (browserAnalytics: ConsentNow | null, id = "synthetic") =>
  JSON.stringify({ browserAnalytics, user: { id } });

describe(answerNews, () => {
  it("says nothing changed while the server holds the same choice", () => {
    expect(
      answerNews(answer(granted), { ...granted, userId: "synthetic" })
    ).toBe("same");
    expect(answerNews("not json", { ...granted, userId: "synthetic" })).toBe(
      "same"
    );
  });

  it("says it changed for another choice, an expired one, or none measured", () => {
    for (const now of [refused, undecided, null]) {
      expect(answerNews(answer(now), { ...granted, userId: "synthetic" })).toBe(
        "changed"
      );
    }
  });

  it("says another person signed in, whatever their choice", () => {
    expect(
      answerNews(answer(granted, "someone-else"), {
        ...granted,
        userId: "synthetic",
      })
    ).toBe("otherPerson");
  });
});
