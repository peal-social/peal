import type { Schema } from "effect";

// What may leave the site, the docs and the blog for PostHog: the SDK's
// `before_send`. An allowlist of events and of property keys; anything
// else is dropped. Values that could carry text (the page's address, the
// referrer, the campaign) are not cleaned but recomputed from the page.

/** A property's value, as JSON holds it. */
export type PropertyValue = typeof Schema.Json.Type;

/** An event's properties, by key. */
export type EventProperties = Record<string, PropertyValue>;

/** An event as the SDK hands it to `before_send`. */
export interface SiteEvent {
  event: string;
  properties: EventProperties;
  uuid: string;
  $set?: EventProperties;
  $set_once?: EventProperties;
  $unset?: string[];
  timestamp?: Date;
}

/** What the recomputed properties are read from: the page being read. */
export interface PageFacts {
  readonly host: string;
  readonly origin: string;
  readonly pathname: string;
  readonly referrer: string;
  readonly search: string;
}

/** What every event carries of Peal's own. */
export interface CommonProperties {
  readonly environment: string;
  readonly locale: "en" | "fr";
  readonly source: "blog" | "docs" | "site";
}

/**
 * The events these surfaces send, and no other. Names are persisted for
 * whoever queries PostHog: add, never rename.
 */
export const siteEventNames = [
  "$opt_in",
  "$pageleave",
  "$pageview",
  "$web_vitals",
  "consent_answered",
  "docs_assistant_asked",
  "docs_search_result_opened",
  "docs_search_used",
  "pricing_calculator_used",
  "site_cta_clicked",
] as const;

/** The name of an event these surfaces send. */
export type SiteEventName = (typeof siteEventNames)[number];

/** The same names, for an event the SDK hands back under any name. */
export const siteEvents: ReadonlySet<string> = new Set(siteEventNames);

/** The properties kept as the SDK sets them: ids, numbers and enums. */
export const keptProperties: ReadonlySet<string> = new Set([
  // What PostHog needs to take an event and tie it to a session.
  "$config_defaults",
  "$device_id",
  "$insert_id",
  "$is_identified",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "$session_id",
  "$time",
  "$window_id",
  "distinct_id",
  "token",
  // The SDK's mark on an event whose visitor PostHog identifies by the
  // day's hash, with nothing stored in the browser.
  "$cookieless_mode",
  // The browser's family and the screen's size, nothing finer.
  "$browser",
  "$browser_version",
  "$device_type",
  "$os",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  // How long the page before was read, and how far down.
  "$prev_pageview_duration",
  "$prev_pageview_last_scroll",
  "$prev_pageview_last_scroll_percentage",
  "$prev_pageview_max_scroll",
  "$prev_pageview_max_scroll_percentage",
  "$prev_pageview_pathname",
  // How fast the page loaded, as numbers.
  "$web_vitals_CLS_value",
  "$web_vitals_FCP_value",
  "$web_vitals_INP_value",
  "$web_vitals_LCP_value",
  // Each of Peal's own events' properties: enums and counts.
  "accounts",
  "answer",
  "band",
  "cta",
  "place",
  "position",
  "query_chars",
  "results",
]);

/**
 * The user agent as the browser sent it, on a counted event alone: PostHog
 * counts a visitor without a cookie by a hash of the day's salt, the
 * address, the host and this, refuses an event without it
 * (`cookieless_missing_user_agent`), and drops it and the address before
 * it stores the event. A followed event is no part of that hash, and would
 * keep it: it goes without.
 */
export const hashedProperties: ReadonlySet<string> = new Set([
  "$raw_user_agent",
]);

/** The properties written from the page, never from what the SDK read. */
export const recomputedProperties: ReadonlySet<string> = new Set([
  "$current_url",
  "$geoip_disable",
  "$host",
  "$pathname",
  "$referring_domain",
  "environment",
  "locale",
  "source",
  "utm_campaign",
  "utm_medium",
  "utm_source",
]);

const campaignKeys = ["utm_source", "utm_medium", "utm_campaign"] as const;

const campaignValue = /^[a-z0-9_.-]{1,64}$/u;

/** The campaign labels of the page's query that pass, lower-cased. */
export const campaignOf = (search: string): Record<string, string> => {
  const query = new URLSearchParams(search);

  return Object.fromEntries(
    campaignKeys.flatMap((key) => {
      const value = query.get(key)?.trim().toLowerCase();

      return value !== undefined && campaignValue.test(value)
        ? [[key, value]]
        : [];
    })
  );
};

/** The host name the visitor came from, when it is another site's. */
export const referringDomainOf = (
  referrer: string,
  host: string
): string | undefined => {
  const url = URL.parse(referrer);

  if (url === null || (url.protocol !== "https:" && url.protocol !== "http:")) {
    return undefined;
  }

  return url.host === host ? undefined : url.hostname;
};

/**
 * The event to send, or null to drop it: only the events above, with only
 * the properties above, the page's address without its query, the
 * referrer's domain alone, three campaign labels, and never a person's
 * properties.
 */
export const sanitized = (
  event: SiteEvent,
  page: PageFacts,
  common: CommonProperties
): SiteEvent | null => {
  if (!siteEvents.has(event.event)) {
    return null;
  }

  const counted = event.properties["$cookieless_mode"] === true;

  const kept = Object.fromEntries(
    Object.entries(event.properties).filter(
      ([key]) =>
        keptProperties.has(key) || (counted && hashedProperties.has(key))
    )
  );

  const referringDomain = referringDomainOf(page.referrer, page.host);

  const referring =
    referringDomain === undefined
      ? []
      : [["$referring_domain", referringDomain] as const];

  const result: SiteEvent = {
    event: event.event,
    properties: {
      ...kept,
      ...campaignOf(page.search),
      ...Object.fromEntries(referring),
      $current_url: `${page.origin}${page.pathname}`,
      $geoip_disable: true,
      $host: page.host,
      $pathname: page.pathname,
      environment: common.environment,
      locale: common.locale,
      source: common.source,
    },
    uuid: event.uuid,
  };

  if (event.timestamp !== undefined) {
    result.timestamp = event.timestamp;
  }

  return result;
};
