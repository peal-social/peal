import { answerCookieName, consentDays } from "./answer";

// The cookies the consent notice and measurement write, apart from
// answer.ts so the script layouts load up front reads without writing.

/** A cookie's attributes, as `js-cookie` writes them. */
export interface CookieAttributes {
  readonly domain: string | undefined;
  /** Days from now; negative expires it at once. */
  readonly expires: number;
  readonly path: "/";
  readonly sameSite: "lax";
  readonly secure: boolean;
}

/** A cookie to write: its name, value and attributes. */
export interface CookieWrite {
  readonly attributes: CookieAttributes;
  readonly name: string;
  readonly value: string;
}

/**
 * The answer cookie, `1.<a|r>.<day>`: 183 days, on the parent domain when
 * one is configured, `Secure` on https.
 */
export const answerCookie = (
  answer: "allowed" | "refused",
  today: number,
  domain: string | undefined,
  secure = true
): CookieWrite => ({
  attributes: {
    domain,
    expires: consentDays,
    path: "/",
    sameSite: "lax",
    secure,
  },
  name: answerCookieName,
  value: `1.${answer === "allowed" ? "a" : "r"}.${String(today)}`,
});

/** A cookie expired at once, on the same domain it was set on. */
export const forgottenCookie = (
  name: string,
  domain: string | undefined,
  secure = true
): CookieWrite => ({
  attributes: { domain, expires: -1, path: "/", sameSite: "lax", secure },
  name,
  value: "",
});
