// What the SDK is started with: every option that keeps what leaves the
// browser to page views, errors and masked recordings, pinned.
import { describe, expect, it } from "@effect/vitest";

import { initOptionsOf } from "#measurement/options.ts";
import {
  elsewhere,
  maskAttributeFor,
  maskRequest,
  replayMaskingOf,
} from "#measurement/replay-masking.ts";

const beforeSend = () => null;

const origin = "https://app.peal.test";

const optionsOf = (identified: boolean) => {
  const {
    logs,
    session_recording: recording,
    ...options
  } = initOptionsOf({
    beforeSend,
    hostname: "app.peal.test",
    identified,
    origin,
  });

  return { logs, options, recording };
};

const maskAttribute = maskAttributeFor(origin);

// The same in both modes.
const shared = {
  advanced_disable_feature_flags: true,
  api_host: "/pulse",
  autocapture: false,
  before_send: beforeSend,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_heatmaps: false,
  capture_pageleave: true,
  capture_pageview: "history_change",
  capture_performance: false,
  cross_subdomain_cookie: false,
  defaults: "2026-08-30",
  disable_conversations: true,
  disable_external_dependency_loading: true,
  disable_product_tours: true,
  disable_surveys: true,
  disable_web_experiments: true,
  enable_recording_console_log: false,
  mask_all_element_attributes: true,
  mask_all_text: true,
  person_profiles: "identified_only",
  rageclick: false,
  respect_dnt: true,
  save_campaign_params: false,
  save_referrer: false,
  secure_cookie: true,
};

describe(initOptionsOf, () => {
  it("keeps nothing in the browser and records nothing while anonymous", () => {
    expect(optionsOf(false).options).toStrictEqual({
      ...shared,
      disable_session_recording: true,
      persistence: "memory",
      tracing_headers: [],
    });
  });

  it("keeps a session and records once identified, naming it to Peal alone", () => {
    expect(optionsOf(true).options).toStrictEqual({
      ...shared,
      disable_session_recording: false,
      persistence: "localStorage",
      tracing_headers: ["app.peal.test"],
    });
  });

  // Flags off, not the remote configuration replay needs.
  it("leaves the project's configuration on", () => {
    expect(optionsOf(true).options).not.toHaveProperty(
      "advanced_disable_flags"
    );
  });
});

describe("the SDK's logs", () => {
  it("never leave, whatever the project's settings say", () => {
    const { logs } = optionsOf(true);

    expect(logs.captureConsoleLogs).toBeFalsy();
    expect(logs.beforeSend()).toBeNull();
  });
});

describe("the recording's masking", () => {
  it("masks every text, input and medium", () => {
    const { recording } = optionsOf(true);

    expect(recording).toMatchObject({
      captureCanvas: { recordCanvas: false },
      captureJsonLd: false,
      collectFonts: false,
      maskAllInputs: true,
      maskTextSelector: "*",
      recordBody: false,
      recordCrossOriginIframes: false,
      recordHeaders: false,
    });

    for (const blocked of [
      "img",
      "video",
      "canvas",
      "iframe",
      "input[type=file]",
      "[data-replay-block]",
    ]) {
      expect(recording.blockSelector.split(", ")).toContain(blocked);
    }
  });

  it.each([
    ["alt", "A synthetic photo"],
    ["title", "Synthetic"],
    ["placeholder", "Write something"],
    ["value", "secret"],
    ["aria-label", "Open Synthetic studio"],
    ["data-name", "Synthetic"],
  ])("writes %s as asterisks", (name, value) => {
    expect(maskAttribute(name, value)).toBe("*".repeat(value.length));
  });

  it("keeps Peal's own address as its pattern, and other attributes as they are", () => {
    expect(
      maskAttribute(
        "href",
        "/fr/app/4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70/posts?token=secret#y"
      )
    ).toBe("/app/:id/posts");
    expect(maskAttribute("action", `${origin}/app/account?x=1`)).toBe(
      "/app/account"
    );
    expect(maskAttribute("class", "flex gap-2")).toBe("flex gap-2");
    expect(replayMaskingOf(origin).maskAttributeFn("role", "link")).toBe(
      "link"
    );
  });

  it.each([
    ["href", "https://social.example/@synthetic_handle"],
    ["href", "mailto:someone@example.test"],
    ["src", "https://cdn.example/a.png?sig=1"],
    ["poster", "https://cdn.example/poster.jpg"],
    ["action", "https://forms.example/submit"],
  ])("shows nothing of %s %s, which leads away from Peal", (name, value) => {
    expect(maskAttribute(name, value)).toBe(elsewhere);
  });

  it("keeps a request's origin, pattern and timing, never its headers or body", () => {
    const masked = maskRequest({
      duration: 12,
      entryType: "resource",
      method: "POST",
      name: "https://app.peal.test/api/workspaces/4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70/posts?q=secret",
      requestBody: '{"text":"secret"}',
      requestHeaders: { cookie: "synthetic" },
      responseBody: "{}",
      responseHeaders: {},
      startTime: 3,
      status: 201,
    });

    expect(masked).toStrictEqual({
      duration: 12,
      entryType: "resource",
      method: "POST",
      name: "https://app.peal.test/api/workspaces/:id/posts",
      startTime: 3,
      status: 201,
    });
  });
});
