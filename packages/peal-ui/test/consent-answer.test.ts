import { describe, expect, it } from "vitest";

import {
  answerCookie,
  answerOf,
  consentDays,
  dayOf,
  forgottenCookie,
  givenAnswerOf,
  modeOf,
  signalsOf,
} from "../src/lib/site/consent/answer";

const today = dayOf(Date.UTC(2026, 10, 19));

// The cookie as a browser hands it back in a Cookie header.
const header = (answer: "allowed" | "refused", day: number) => {
  const { name, value } = answerCookie(answer, day, undefined);

  return `other=1; ${name}=${value}; ph_x=2`;
};

const noSignal = { doNotTrack: false, globalPrivacyControl: false };

describe("the answer cookie", () => {
  it("round-trips each answer with its day", () => {
    expect(answerOf(header("allowed", today), today)).toBe("allowed");
    expect(answerOf(header("refused", today), today)).toBe("refused");
    expect(givenAnswerOf(header("allowed", today - 3), today)).toStrictEqual({
      answer: "allowed",
      day: today - 3,
    });
  });

  it("holds for 183 days: day 182 is still an answer, day 183 is none", () => {
    expect(consentDays).toBe(183);
    expect(answerOf(header("allowed", today - 182), today)).toBe("allowed");
    expect(answerOf(header("allowed", today - 183), today)).toBe("none");
  });

  it("reads nothing it cannot parse", () => {
    for (const garbage of [
      "",
      "peal.consent=",
      "peal.consent=1.x.20000",
      "peal.consent=2.a.20000",
      "peal.consent=1.a.",
      "peal.consent=1.a.abc",
      "xpeal.consent=1.a.20000",
      `peal.consent=1.a.${String(today + 5)}`,
    ]) {
      expect(answerOf(garbage, today)).toBe("none");
    }
  });

  it("is written for 183 days on the configured domain, Lax and Secure", () => {
    expect(answerCookie("refused", today, "peal.social")).toStrictEqual({
      attributes: {
        domain: "peal.social",
        expires: 183,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
      name: "peal.consent",
      value: `1.r.${String(today)}`,
    });
    expect(
      answerCookie("allowed", today, undefined, false).attributes
    ).toStrictEqual({
      domain: undefined,
      expires: 183,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("is forgotten on the domain it was set on", () => {
    expect(forgottenCookie("ph_x_posthog", "peal.social")).toStrictEqual({
      attributes: {
        domain: "peal.social",
        expires: -1,
        path: "/",
        sameSite: "lax",
        secure: true,
      },
      name: "ph_x_posthog",
      value: "",
    });
  });
});

describe("a page's mode", () => {
  it("is off while measurement is not configured", () => {
    expect(
      modeOf({ answer: "allowed", configured: false, signals: noSignal })
    ).toBe("off");
  });

  it("is counted with no answer, an expired one or a refusal", () => {
    expect(
      modeOf({ answer: "none", configured: true, signals: noSignal })
    ).toBe("counted");
    expect(
      modeOf({ answer: "refused", configured: true, signals: noSignal })
    ).toBe("counted");
  });

  it("is followed once allowed", () => {
    expect(
      modeOf({ answer: "allowed", configured: true, signals: noSignal })
    ).toBe("followed");
  });

  it("is off whatever the answer when the browser sends Do Not Track or Global Privacy Control", () => {
    for (const signals of [
      { doNotTrack: true, globalPrivacyControl: false },
      { doNotTrack: false, globalPrivacyControl: true },
    ]) {
      for (const answer of ["allowed", "none", "refused"] as const) {
        expect(modeOf({ answer, configured: true, signals })).toBe("off");
      }
    }
  });

  it("reads the signals as the web app does", () => {
    expect(signalsOf({ doNotTrack: "1" }).doNotTrack).toBe(true);
    expect(signalsOf({ doNotTrack: "yes" }).doNotTrack).toBe(true);
    expect(signalsOf({ doNotTrack: "0" }).doNotTrack).toBe(false);
    expect(signalsOf({ doNotTrack: null }).doNotTrack).toBe(false);
    expect(signalsOf({ globalPrivacyControl: true }).globalPrivacyControl).toBe(
      true
    );
    expect(signalsOf({}).globalPrivacyControl).toBe(false);
  });
});
