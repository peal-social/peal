import { relayPrefix } from "./relay-prefix.ts";
import { replayMasking } from "./replay-masking.ts";
import type { MeasuredEvent } from "./sanitize.ts";

/** What the SDK is started with, for one of the two measured modes. */
export const initOptionsOf = ({
  beforeSend,
  hostname,
  identified,
}: {
  /** The SDK's `before_send`: `sanitized`, on the page's current state. */
  readonly beforeSend: (event: MeasuredEvent) => MeasuredEvent | null;
  /** Peal's host, whose API requests name the session once identified. */
  readonly hostname: string;
  readonly identified: boolean;
}) => ({
  // Feature flags off, but not the project's configuration, which turns
  // session replay on.
  advanced_disable_feature_flags: true,
  api_host: relayPrefix,
  autocapture: false,
  before_send: beforeSend,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_pageleave: true,
  capture_pageview: "history_change" as const,
  capture_performance: false,
  cross_subdomain_cookie: false,
  defaults: "2026-08-30" as const,
  disable_conversations: true,
  disable_external_dependency_loading: true,
  disable_product_tours: true,
  disable_session_recording: !identified,
  disable_surveys: true,
  disable_web_experiments: true,
  enable_recording_console_log: false,
  mask_all_element_attributes: true,
  mask_all_text: true,
  // Nothing written to the browser until the person allows it.
  persistence: identified ? ("localStorage" as const) : ("memory" as const),
  person_profiles: "identified_only" as const,
  rageclick: false,
  respect_dnt: true,
  save_campaign_params: false,
  save_referrer: false,
  secure_cookie: true,
  session_recording: replayMasking,
  tracing_headers: identified ? [hostname] : [],
});

/** What changes in place once the person allows it. */
export const identifiedConfigOf = (hostname: string) => ({
  disable_session_recording: false,
  persistence: "localStorage" as const,
  tracing_headers: [hostname],
});

/** What changes in place once they withdraw, or their choice expired. */
export const anonymousConfig = {
  disable_session_recording: true,
  persistence: "memory" as const,
  tracing_headers: [],
};
