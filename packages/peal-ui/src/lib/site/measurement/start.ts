import { answerOf, consentDays, dayOf, givenAnswerOf } from "../consent/answer";
import type { Answer } from "../consent/answer";
import { ConsentAnswered } from "../consent/consent-answered";
import { forgetVisitor, holdsVisitor } from "../consent/forget";
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
import { referringDomainOf, sanitized } from "./sanitize";
import type { CommonProperties } from "./sanitize";
import { loadSdk } from "./sdk";
import type { SiteSdk } from "./sdk";
import { watchWebVitals } from "./web-vitals";

// Measurement on the site, the docs and the blog, which consent/start.ts
// loads once the page is idle unless the browser asks not to be followed.
// The answer cookie is the one source of truth: the SDK is brought in line
// with it on load, whenever the page is shown again, and before each event
// leaves, so a tab left open never follows a visitor whose cookie a
// sign-up or another tab removed.

const sourceOf = (value: string | undefined): CommonProperties["source"] =>
  value === "docs" || value === "blog" ? value : "site";

const localeOf = (value: string | undefined): CommonProperties["locale"] =>
  value === "fr" ? "fr" : "en";

const present = (value: string | undefined) => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
};

/** What the SDK names a visitor while it counts without a cookie. */
const cookieless = "$posthog_cookieless";

/** What brings the SDK in line with the answer, from what holds now. */
export type Alignment = "forget" | "follow" | "none" | "renew";

/**
 * What to do so the SDK follows the answer: `follow` (opt in), `forget`
 * (opt out and forget the visitor), `renew` (a new visitor, linked to
 * none, where the answer still allows it but the cookie is gone: a
 * sign-up or another tab removed it), or nothing.
 */
export const alignmentOf = ({
  answer,
  following,
  holdsCookie,
}: {
  readonly answer: Answer;
  readonly following: boolean;
  readonly holdsCookie: boolean;
}): Alignment => {
  if (answer !== "allowed") {
    return following ? "forget" : "none";
  }

  if (!following) {
    return "follow";
  }

  return holdsCookie ? "none" : "renew";
};

/** The days an answer given on `day` has left on `today`, at least one. */
export const daysLeft = (day: number, today: number): number =>
  Math.max(1, consentDays - (today - day));

/** What a page needs from `<peal-consent>`: its settings. */
export interface MeasuredElement {
  readonly dataset: DOMStringMap;
}

let started = false;

/** Starts measuring the page `element` (`<peal-consent>`) describes. */
export const startMeasurement = async (
  element: MeasuredElement,
  load: () => Promise<SiteSdk> = loadSdk,
  watch: typeof watchWebVitals = watchWebVitals
): Promise<void> => {
  const key = present(element.dataset["key"]);
  const host = present(element.dataset["host"]);

  if (started || key === undefined || host === undefined) {
    return;
  }

  started = true;

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

  const today = dayOf(Date.now());
  const given = givenAnswerOf(document.cookie, today);

  // What the SDK may keep of the visit's source: the page without its
  // query, the referrer's origin alone.
  const referringDomain = referringDomainOf(document.referrer, location.host);

  const source = {
    referrer:
      referringDomain === undefined
        ? "$direct"
        : new URL(document.referrer).origin,
    url: `${location.origin}${location.pathname}`,
  };

  let following = false;
  let aligning = false;

  // Brings the SDK in line with the answer cookie, as `alignmentOf` says.
  const align = () => {
    const alignment = alignmentOf({
      answer: answerOf(document.cookie, dayOf(Date.now())),
      following,
      holdsCookie: holdsVisitor(key),
    });

    if (alignment === "none") {
      return;
    }

    aligning = true;

    if (alignment === "follow") {
      following = true;
      sdk.opt_in_capturing();
    } else if (alignment === "renew") {
      sdk.reset();
    } else {
      following = false;

      const before = sdk.get_distinct_id();

      sdk.opt_out_capturing();
      forgetVisitor(key);

      // The SDK still names the visitor it followed: a new page forgets it.
      if (before !== cookieless && sdk.get_distinct_id() === before) {
        location.reload();
      }
    }

    sdk.keepSessionSource(source);
    aligning = false;
  };

  sdk.init(
    key,
    initOptionsOf(
      {
        cookieDomain: present(element.dataset["cookieDomain"]),
        environment: common.environment,
        host,
        key,
      },
      (event) => {
        // Never an event under a visitor the answer no longer allows, nor
        // one whose cookie is gone: the page is brought in line first.
        if (
          following &&
          !aligning &&
          (answerOf(document.cookie, dayOf(Date.now())) !== "allowed" ||
            !holdsVisitor(key))
        ) {
          queueMicrotask(align);

          return null;
        }

        if (following) {
          queueMicrotask(() => {
            sdk.keepSessionSource(source);
          });
        }

        return sanitized(
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
        );
      },
      given?.answer === "allowed" ? daysLeft(given.day, today) : consentDays
    )
  );

  following = sdk.get_explicit_consent_status() === "granted";

  // A visitor followed before, whose answer expired or changed: the SDK
  // is told the page holds no answer that allows it.
  align();

  const send = (measured: Measured | undefined) => {
    if (measured !== undefined) {
      sdk.capture(measured.event, measured.properties);
    }
  };

  watch((properties) => {
    sdk.capture("$web_vitals", properties, true);
  });

  window.addEventListener(ConsentAnswered.type, (event) => {
    if (event instanceof ConsentAnswered) {
      send(consentAnswered(event.detail));
      align();
    }
  });

  // A tab shown again, or restored from the back-forward cache, may hold
  // an answer or a cookie another tab changed.
  window.addEventListener("pageshow", align);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      align();
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
      align();
      sdk.capture("$pageview", {});
    }
  });
};
