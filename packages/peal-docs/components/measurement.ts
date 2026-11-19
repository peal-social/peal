import { consentMessages } from "peal-ui/lib/site/consent/messages";
import {
  consentAttributes,
  measurementSettings,
} from "peal-ui/lib/site/measurement/settings";

// The docs' consent notice and measurement, from the settings read when
// the docs are built (DOCS_POSTHOG_*, DOCS_PRIVACY_URL): the site's, from
// peal-ui, with no Blume analytics adapter, whose script would load from
// PostHog and send what it reads unfiltered.

const settings = measurementSettings({
  cookieDomain: process.env.DOCS_POSTHOG_COOKIE_DOMAIN,
  environment: process.env.DOCS_POSTHOG_ENVIRONMENT,
  host: process.env.DOCS_POSTHOG_HOST,
  key: process.env.DOCS_POSTHOG_KEY,
  prefix: "DOCS",
});

const french = (locale: string | undefined) => locale === "fr";

/**
 * The privacy policy on the marketing site in the reader's language: the
 * site serves French under `/fr` after its origin.
 */
export const privacyLink = (
  english: string | undefined,
  locale: string | undefined
): string | undefined => {
  const trimmed = english?.trim();

  if (trimmed === undefined || trimmed === "") {
    return undefined;
  }

  const url = new URL(trimmed);

  return french(locale) ? `${url.origin}/fr${url.pathname}` : url.href;
};

/** What the docs' footer renders: none while measurement is off. */
export const docsConsent = (locale: string | undefined) =>
  settings === undefined
    ? undefined
    : {
        attributes: consentAttributes(settings, {
          locale: french(locale) ? "fr" : "en",
          policy: privacyLink(process.env.DOCS_PRIVACY_URL, locale),
          source: "docs",
        }),
        settings: consentMessages[french(locale) ? "fr" : "en"].settings,
      };
