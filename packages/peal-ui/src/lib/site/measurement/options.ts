import type { SiteEvent } from "./sanitize";
import type { MeasurementSettings } from "./settings";

// A log record the SDK would send: never.
const dropLog = () => null;

/**
 * What the SDK is started with on the site, the docs and the blog: page
 * views, leaves with scroll, and web vitals, counted without a cookie
 * until the visitor allows one (PostHog's cookieless mode, on before any
 * answer and after a refusal), then in one cookie on the parent domain.
 * The web app's refusals all hold: no autocapture, no recording, no
 * surveys, no flags, nothing loaded from PostHog.
 */
export const initOptionsOf = (
  settings: MeasurementSettings,
  beforeSend: (event: SiteEvent) => SiteEvent | null
) => ({
  // No flags and no remote configuration: the SDK keeps its own `/e/`,
  // which the relay's site mode answers.
  advanced_disable_flags: true,
  api_host: settings.host,
  autocapture: false,
  before_send: beforeSend,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_pageleave: true,
  // The first page view on load; the docs' client router's next ones are
  // captured by start.ts on each page it shows.
  capture_pageview: true,
  // No network timing; web vitals are measured by web-vitals.ts.
  capture_performance: false,
  cookie_expiration: 183,
  // Counted with the day's server-side hash before an answer and after a
  // refusal: nothing stored in the browser for it.
  cookieless_mode: "on_reject" as const,
  cross_subdomain_cookie: settings.cookieDomain !== undefined,
  defaults: "2026-08-30" as const,
  disable_conversations: true,
  disable_external_dependency_loading: true,
  disable_product_tours: true,
  disable_session_recording: true,
  disable_surveys: true,
  disable_web_experiments: true,
  // No log leaves, whatever the project's settings say.
  logs: { beforeSend: dropLog, captureConsoleLogs: false },
  opt_out_capturing_by_default: true,
  opt_out_capturing_persistence_type: "cookie" as const,
  // All of the SDK's state in its one cookie, so expiring it forgets the
  // visitor.
  persistence: "cookie" as const,
  person_profiles: "identified_only" as const,
  rageclick: false,
  save_campaign_params: false,
  save_referrer: false,
  secure_cookie: true,
});
