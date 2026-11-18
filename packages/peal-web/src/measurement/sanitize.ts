import { Option, Schema } from "effect";

import type { Mode } from "./mode.ts";
import { addressOf, patternOf } from "./place.ts";

/** A property's value, as JSON holds it. */
export type PropertyValue = typeof Schema.Json.Type;

/** An event's properties, by key. */
export type EventProperties = Record<string, PropertyValue>;

/** An event as the SDK hands it to `before_send`. */
export interface MeasuredEvent {
  uuid: string;
  event: string;
  properties: EventProperties;
  $set?: EventProperties;
  $set_once?: EventProperties;
  $unset?: string[];
  timestamp?: Date;
}

/** What the rules of an event depend on. */
export interface SanitizeState {
  readonly mode: Mode;
  /** The person's account id, which an anonymous event never carries. */
  readonly userId: string;
}

/**
 * The events the web app sends, and no other: page views and leaves, the
 * person and the workspace being named (identified only), errors, and the
 * recording's data (identified only).
 */
export const sentEvents: ReadonlySet<string> = new Set([
  "$exception",
  "$groupidentify",
  "$identify",
  "$pageleave",
  "$pageview",
  "$snapshot",
]);

/**
 * Every property an event may carry: an id, an enum, a number or a
 * boolean, never a text someone wrote, a name, an address or a title.
 * Anything else is left out.
 */
export const sentProperties: ReadonlySet<string> = new Set([
  // What PostHog needs to take an event and tie it to a session.
  "$config_defaults",
  "$device_id",
  "$geoip_disable",
  "$group_key",
  "$group_set",
  "$group_type",
  "$groups",
  "$insert_id",
  "$is_identified",
  "$lib",
  "$lib_version",
  "$pageview_id",
  "$process_person_profile",
  "$recording_status",
  "$session_id",
  "$time",
  "$window_id",
  "distinct_id",
  "token",
  // The page, as a pattern: each id written `:id`, no query, no fragment.
  "$current_url",
  "$host",
  "$pathname",
  "$prev_pageview_duration",
  "$prev_pageview_id",
  "$prev_pageview_last_scroll",
  "$prev_pageview_last_scroll_percentage",
  "$prev_pageview_max_scroll",
  "$prev_pageview_max_scroll_percentage",
  "$prev_pageview_pathname",
  // The browser's family and the screen's size, nothing finer.
  "$browser",
  "$browser_version",
  "$device_type",
  "$os",
  "$screen_height",
  "$screen_width",
  "$viewport_height",
  "$viewport_width",
  // Peal's own.
  "environment",
  "error_kind",
  "release",
  "source",
  "workspace_id",
  // An error, built from the report the server's intake was sent, already
  // redacted.
  "$exception_level",
  "$exception_list",
  "$exception_types",
  "$exception_values",
]);

/**
 * The keys above that name an address, rewritten to a pattern before the
 * event leaves, and the project's token, which every event must carry.
 */
export const rewrittenOrRequired: ReadonlySet<string> = new Set([
  "$current_url",
  "token",
]);

// What only an identified event carries: the workspace.
const identifiedOnly: ReadonlySet<string> = new Set([
  "$group_key",
  "$group_set",
  "$group_type",
  "$groups",
  "workspace_id",
]);

const patterned: ReadonlySet<string> = new Set([
  "$pathname",
  "$prev_pageview_pathname",
]);

const decodeText = Schema.decodeUnknownOption(Schema.String);

const rewritten = (key: string, value: PropertyValue): PropertyValue =>
  Option.match(decodeText(value), {
    onNone: () => value,
    onSome: (text) => {
      if (key === "$current_url") {
        return addressOf(text);
      }

      return patterned.has(key) ? patternOf(text) : value;
    },
  });

// The properties an event keeps, rewritten.
const keptProperties = (
  properties: EventProperties,
  identified: boolean
): EventProperties =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(
        ([key]) =>
          sentProperties.has(key) && (identified || !identifiedOnly.has(key))
      )
      .map(([key, value]) => [
        key,
        // A group's properties are the server's to set.
        key === "$group_set" ? {} : rewritten(key, value),
      ])
  );

/**
 * The SDK's `before_send`: the event to send, or null to drop it. Nothing
 * leaves while the page is `off`; a recording's data only once the person
 * allowed it, untouched (its masking happens as it is recorded); every
 * other event keeps only the properties above, never sets a person's
 * properties (the server alone does), and an anonymous one names no
 * workspace and never the person.
 */
export const sanitized = (
  event: MeasuredEvent,
  { mode, userId }: SanitizeState
): MeasuredEvent | null => {
  if (mode === "off" || !sentEvents.has(event.event)) {
    return null;
  }

  const identified = mode === "identified";

  if (event.event === "$snapshot") {
    return identified ? event : null;
  }

  // A guard against a bug: an anonymous event never names the person.
  if (
    !identified &&
    (event.event === "$identify" ||
      event.event === "$groupidentify" ||
      event.properties["distinct_id"] === userId)
  ) {
    return null;
  }

  const kept: MeasuredEvent = {
    event: event.event,
    properties: keptProperties(event.properties, identified),
    uuid: event.uuid,
  };

  if (event.timestamp !== undefined) {
    kept.timestamp = event.timestamp;
  }

  return kept;
};
