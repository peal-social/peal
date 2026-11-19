import Cookies from "js-cookie";

import { answerOf, dayOf } from "../consent/answer";
import { ConsentAnswered } from "../consent/consent-answered";
import { forgottenCookie } from "../consent/cookies";
import {
  blumeTrackOf,
  consentAnswered,
  ctaClicked,
  docsTracked,
  pricingPerPage,
  pricingUsed,
} from "./events";
import type { Measured } from "./events";
import { initOptionsOf } from "./options";
import { PricingChanged } from "./pricing-changed";
import { sanitized } from "./sanitize";
import type { CommonProperties } from "./sanitize";
import { loadSdk } from "./sdk";
import type { SiteSdk } from "./sdk";
import { watchWebVitals } from "./web-vitals";

// Measurement on the site, the docs and the blog, which consent/start.ts
// loads once the page is idle unless the browser asks not to be followed.
// The answer cookie is the one source of truth: the SDK's own consent is
// brought in line with it on every load.

const sourceOf = (value: string | undefined): CommonProperties["source"] =>
  value === "docs" || value === "blog" ? value : "site";

const localeOf = (value: string | undefined): CommonProperties["locale"] =>
  value === "fr" ? "fr" : "en";

const present = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
};

const isTheSdks = (key: string) =>
  key.startsWith("ph_") || key.startsWith("__ph");

/** What the SDK names a visitor while it counts without a cookie. */
const cookieless = "$posthog_cookieless";

// Forgets the visitor: the SDK's cookie, on the domain it was set on and
// on the page's own host, and whatever it kept in the browser's storage.
const forget = (key: string, cookieDomain: string | undefined) => {
  const secure = location.protocol === "https:";

  for (const domain of new Set([cookieDomain, undefined])) {
    const { attributes, name } = forgottenCookie(
      `ph_${key}_posthog`,
      domain,
      secure
    );

    Cookies.remove(name, attributes);
  }

  for (const storage of [localStorage, sessionStorage]) {
    for (const name of Object.keys(storage).filter(isTheSdks)) {
      storage.removeItem(name);
    }
  }
};

let started = false;

/** Starts measuring the page `element` (`<peal-consent>`) describes. */
export const startMeasurement = async (
  element: HTMLElement,
  load: () => Promise<SiteSdk> = loadSdk
): Promise<void> => {
  const key = present(element.dataset["key"]);
  const host = present(element.dataset["host"]);

  if (started || key === undefined || host === undefined) {
    return;
  }

  started = true;
  const cookieDomain = present(element.dataset["cookieDomain"]);

  const common: CommonProperties = {
    environment: present(element.dataset["environment"]) ?? "production",
    locale: localeOf(element.dataset["locale"]),
    source: sourceOf(element.dataset["source"]),
  };

  const sdk = await load().catch(() => null);

  if (sdk === null) {
    // A load that fails leaves the page unmeasured.
    return;
  }

  sdk.init(
    key,
    initOptionsOf(
      { cookieDomain, environment: common.environment, host, key },
      (event) =>
        sanitized(
          event,
          {
            host: location.host,
            origin: location.origin,
            pathname: location.pathname,
            referrer: document.referrer,
            search: location.search,
          },
          // The docs' client router changes the page's language in place.
          { ...common, locale: localeOf(document.documentElement.lang) }
        )
    )
  );

  const send = (measured: Measured | undefined) => {
    if (measured !== undefined) {
      sdk.capture(measured.event, measured.properties);
    }
  };

  watchWebVitals((properties) => {
    sdk.capture("$web_vitals", properties, true);
  });

  // The SDK's consent follows the answer cookie.
  const answer = answerOf(document.cookie, dayOf(Date.now()));
  const consent = sdk.get_explicit_consent_status();

  if (answer === "allowed" && consent !== "granted") {
    sdk.opt_in_capturing();
  } else if (answer !== "allowed" && consent === "granted") {
    sdk.opt_out_capturing();
    forget(key, cookieDomain);
  }

  window.addEventListener(ConsentAnswered.type, (event) => {
    if (!(event instanceof ConsentAnswered)) {
      return;
    }

    send(consentAnswered(event.detail));

    if (event.detail.answer === "allowed") {
      sdk.opt_in_capturing();

      return;
    }

    const before = sdk.get_distinct_id();
    sdk.opt_out_capturing();
    forget(key, cookieDomain);

    // The SDK still names the visitor it followed: a new page forgets it.
    if (before !== cookieless && sdk.get_distinct_id() === before) {
      location.reload();
    }
  });

  document.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-measure-cta]")
        : null;

    if (target !== null) {
      send(
        ctaClicked(target.dataset["measureCta"], target.dataset["measurePlace"])
      );
    }
  });

  let pricing = 0;

  window.addEventListener(PricingChanged.type, (event) => {
    if (event instanceof PricingChanged && pricing < pricingPerPage) {
      pricing += 1;
      send(pricingUsed(event.detail));
    }
  });

  window.addEventListener("blume:track", (event) => {
    const track = blumeTrackOf(event);

    if (track !== undefined) {
      send(docsTracked(track));
    }
  });

  // The docs' client router: a page view for each new page it shows (the
  // SDK captured the first itself).
  let shown = location.pathname;

  document.addEventListener("astro:page-load", () => {
    if (location.pathname !== shown) {
      shown = location.pathname;
      pricing = 0;
      sdk.capture("$pageview", {});
    }
  });
};
