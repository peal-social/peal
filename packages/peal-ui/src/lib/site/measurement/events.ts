import type { ConsentDetail } from "../consent/consent-answered";
import type { PricingDetail } from "./pricing-changed";

// Peal's own events on the site, the docs and the blog: enums and counts
// only, never a text someone typed. A value outside a list sends nothing.

/** The calls to action a click is counted on (`data-measure-cta`). */
export const ctas = [
  "dashboard",
  "discord",
  "docs",
  "get_started",
  "github",
  "log_in",
  "pricing",
  "self_host",
  "talk_to_sales",
] as const;

export type Cta = (typeof ctas)[number];

/** Where on the page a call to action sits (`data-measure-place`). */
export const places = [
  "closing",
  "drawer",
  "footer",
  "header",
  "hero",
  "pricing",
  "sidebar",
] as const;

export type Place = (typeof places)[number];

/** An event to capture: its name and its properties. */
export interface Measured {
  readonly event: string;
  readonly properties: Record<string, number | string>;
}

const among = <T extends string>(
  list: readonly T[],
  value: string | undefined
): T | undefined => list.find((item) => item === value);

/** `site_cta_clicked`, when both values are on their lists. */
export const ctaClicked = (
  cta: string | undefined,
  place: string | undefined
): Measured | undefined => {
  const known = among(ctas, cta);
  const where = among(places, place);

  return known === undefined || where === undefined
    ? undefined
    : { event: "site_cta_clicked", properties: { cta: known, place: where } };
};

// A whole number in range, or undefined.
const count = (value: number | undefined, most: number): number | undefined =>
  value !== undefined &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= most
    ? value
    : undefined;

/** `pricing_calculator_used`, from the account calculator's `peal:pricing`. */
export const pricingUsed = (detail: PricingDetail): Measured | undefined => {
  const accounts = count(detail.accounts, 1_000_000);
  const band = count(detail.band, 20);

  return accounts === undefined || band === undefined
    ? undefined
    : { event: "pricing_calculator_used", properties: { accounts, band } };
};

/** What Blume's `blume:track` says, read no further than these numbers. */
export interface BlumeTrack {
  readonly event: string;
  readonly position: number | undefined;
  readonly queryChars: number | undefined;
  readonly results: number | undefined;
}

/**
 * Blume's `blume:track`, read: its name and the three numbers measured,
 * never its query, address, question or answer.
 */
export const blumeTrackOf = (event: Event): BlumeTrack | undefined => {
  const detail: unknown = event instanceof CustomEvent ? event.detail : null;

  if (!(detail instanceof Object) || !("event" in detail)) {
    return undefined;
  }

  const props: unknown = "props" in detail ? detail.props : null;

  // Each number the props hold, and nothing else of them.
  const [position, queryChars, results] = (
    ["position", "queryChars", "results"] as const
  ).map((key) => {
    const value: unknown =
      props instanceof Object && key in props
        ? Object.getOwnPropertyDescriptor(props, key)?.value
        : null;

    const asNumber = Number(value);

    return asNumber === value ? asNumber : undefined;
  });

  return { event: String(detail.event), position, queryChars, results };
};

/** The docs' search and assistant, as Peal's events. */
export const docsTracked = (track: BlumeTrack): Measured | undefined => {
  switch (track.event) {
    case "ask": {
      return { event: "docs_assistant_asked", properties: {} };
    }

    case "search": {
      const results = count(track.results, 1_000_000);
      const queryChars = count(track.queryChars, 1000);

      return results === undefined || queryChars === undefined
        ? undefined
        : {
            event: "docs_search_used",
            properties: { query_chars: queryChars, results },
          };
    }

    case "search_select": {
      const position = count(track.position, 1000);

      return position === undefined
        ? undefined
        : { event: "docs_search_result_opened", properties: { position } };
    }

    default: {
      return undefined;
    }
  }
};

/** `consent_answered`, from the notice's `peal:consent`. */
export const consentAnswered = (detail: ConsentDetail): Measured => ({
  event: "consent_answered",
  properties: { answer: detail.answer },
});

/** At most this many calculator events a page view. */
export const pricingPerPage = 3;
