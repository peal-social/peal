import { describe, expect, it } from "vitest";

import { initOptionsOf } from "../src/lib/site/measurement/options";

const settings = {
  cookieDomain: undefined,
  environment: "production",
  host: "/pulse/site",
  key: "phc_synthetic",
};

const keep = () => null;

describe("the site's SDK options", () => {
  it("count without a cookie until the visitor allows one", () => {
    const options = initOptionsOf(settings, keep);

    expect(options.cookieless_mode).toBe("on_reject");
    expect(options.opt_out_capturing_by_default).toBe(true);
    expect(options.opt_out_capturing_persistence_type).toBe("cookie");
    expect(options.persistence).toBe("cookie");
    expect(options.cookie_expiration).toBe(183);
    expect(options.api_host).toBe("/pulse/site");
    expect(options.before_send).toBe(keep);
  });

  it("share the cookie across subdomains only with a cookie domain", () => {
    expect(initOptionsOf(settings, keep).cross_subdomain_cookie).toBe(false);
    expect(
      initOptionsOf({ ...settings, cookieDomain: "peal.social" }, keep)
        .cross_subdomain_cookie
    ).toBe(true);
  });

  it("measure page views, leaves and web vitals, and nothing else", () => {
    const options = initOptionsOf(settings, keep);

    expect(options.capture_pageview).toBe(true);
    expect(options.capture_pageleave).toBe(true);
    expect(options.capture_performance).toStrictEqual({
      network_timing: false,
      web_vitals: true,
      web_vitals_attribution: false,
    });
    expect(options).toMatchObject({
      advanced_disable_flags: true,
      autocapture: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      defaults: "2026-08-30",
      disable_conversations: true,
      disable_external_dependency_loading: true,
      disable_product_tours: true,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      person_profiles: "identified_only",
      rageclick: false,
      save_campaign_params: false,
      save_referrer: false,
      secure_cookie: true,
    });
    expect(options.logs.captureConsoleLogs).toBe(false);
    expect(options.logs.beforeSend()).toBeNull();
    expect("respect_dnt" in options).toBe(false);
  });
});
