import Cookies from "js-cookie";

import {
  cookieDomainsOf,
  forgottenCookie,
  retiredVisitorCookieName,
  siteConsentCookieName,
  visitorCookieName,
} from "./cookies";

const isTheSdks = (key: string) =>
  key.startsWith("ph_") || key.startsWith("__ph");

/**
 * Forgets the visitor in this browser: PostHog's cookie on every domain it
 * may sit on, its session and local storage entries, and, with `consent`,
 * its own copy of the answer too.
 */
export const forgetVisitor = (key: string, consent = false): void => {
  const secure = location.protocol === "https:";

  const names = consent
    ? [visitorCookieName(key), siteConsentCookieName]
    : [visitorCookieName(key)];

  for (const domain of cookieDomainsOf(location.hostname)) {
    for (const name of names) {
      const { attributes } = forgottenCookie(name, domain, secure);

      Cookies.remove(name, attributes);
    }
  }

  for (const storage of [localStorage, sessionStorage]) {
    for (const name of Object.keys(storage).filter(isTheSdks)) {
      storage.removeItem(name);
    }
  }
};

/** The visitor a sign-up retired in this browser, if any. */
export const retiredVisitor = (): string | undefined =>
  Cookies.get(retiredVisitorCookieName);

/** Whether this browser holds PostHog's cookie for the project. */
export const holdsVisitor = (key: string): boolean =>
  Cookies.get(visitorCookieName(key)) !== undefined;
