// The visitor's answer to the consent notice (DESIGN.md, Site), as the one
// cookie the site, the docs and the blog share, and the mode a page
// measures in. Pure and free of Effect: the script each layout loads up
// front reads it, within its 2 kB budget.

/** How long an answer holds, in days: it is asked again after. */
export const consentDays = 183;

/** The answer cookie's name. */
export const answerCookieName = "peal.consent";

/** What the visitor answered, or `none` when they have not (or it expired). */
export type Answer = "allowed" | "none" | "refused";

/** A page's mode: nothing, counted without a cookie, or followed. */
export type Mode = "counted" | "followed" | "off";

const dayMs = 86_400_000;

/** Whole days since the Unix epoch, in UTC, at `time` (milliseconds). */
export const dayOf = (time: number): number => Math.floor(time / dayMs);

// `peal.consent=1.<a|r>.<day>`, anywhere in a Cookie header.
const answerPattern =
  /(?:^|;\s*)peal\.consent=1\.(?<choice>[ar])\.(?<day>\d{1,6})(?:;|$)/u;

/** The answer and the day it was given, when one holds on `today`. */
export interface GivenAnswer {
  readonly answer: "allowed" | "refused";
  readonly day: number;
}

/** The answer a Cookie header holds on `today`, with its day. */
export const givenAnswerOf = (
  cookieHeader: string,
  today: number
): GivenAnswer | undefined => {
  const groups = answerPattern.exec(cookieHeader)?.groups;

  if (groups === undefined) {
    return undefined;
  }

  const day = Number(groups["day"]);
  const age = today - day;

  if (age < 0 || age >= consentDays) {
    return undefined;
  }

  return { answer: groups["choice"] === "a" ? "allowed" : "refused", day };
};

/** The answer a Cookie header holds on `today`: `none` past 183 days. */
export const answerOf = (cookieHeader: string, today: number): Answer =>
  givenAnswerOf(cookieHeader, today)?.answer ?? "none";

/** What the browser says about being followed. */
export interface Signals {
  readonly doNotTrack: boolean;
  readonly globalPrivacyControl: boolean;
}

/**
 * A page's mode: `off` when measurement is not configured or the browser
 * asks not to be followed (Do Not Track, Global Privacy Control),
 * `followed` once the visitor allowed it, `counted` otherwise (no answer,
 * an expired one, or a refusal).
 */
export const modeOf = ({
  answer,
  configured,
  signals,
}: {
  readonly answer: Answer;
  readonly configured: boolean;
  readonly signals: Signals;
}): Mode => {
  if (!configured || signals.doNotTrack || signals.globalPrivacyControl) {
    return "off";
  }

  return answer === "allowed" ? "followed" : "counted";
};

/** The browser's signals, read as the web app reads them. */
export const signalsOf = (browser: {
  readonly doNotTrack?: string | null | undefined;
  readonly globalPrivacyControl?: boolean | undefined;
}): Signals => ({
  doNotTrack: browser.doNotTrack === "1" || browser.doNotTrack === "yes",
  globalPrivacyControl: browser.globalPrivacyControl === true,
});

/** The signals the browser running the page sends. */
export const browserSignals = (browser: Navigator): Signals =>
  signalsOf({
    doNotTrack: browser.doNotTrack,
    globalPrivacyControl:
      "globalPrivacyControl" in browser &&
      browser.globalPrivacyControl === true,
  });
