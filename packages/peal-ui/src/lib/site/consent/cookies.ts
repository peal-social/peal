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

/**
 * The name PostHog's own copy of the answer goes by on the site, the docs
 * and the blog: not the SDK's default (`__ph_opt_in_out_<token>`), which
 * the web app's SDK, on the same project, would read on the parent domain
 * and take for its own answer.
 */
export const siteConsentCookieName = "peal_site_consent";

/** The cookie PostHog follows a visitor who allowed it in. */
export const visitorCookieName = (key: string): string => `ph_${key}_posthog`;

const ipAddress = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[?[\da-f:]+\]?$/iu;

/**
 * Every domain a cookie of a page at `hostname` may have been set on: the
 * host itself (`undefined`, a host-only cookie) and each parent domain
 * but the top level, so a cookie is forgotten wherever the SDK set it,
 * whichever parent it picked.
 */
export const cookieDomainsOf = (
  hostname: string
): readonly (string | undefined)[] => {
  if (ipAddress.test(hostname) || !hostname.includes(".")) {
    return [undefined];
  }

  const labels = hostname.split(".");

  return [
    undefined,
    ...labels.slice(0, -1).map((_, index) => labels.slice(index).join(".")),
  ];
};
