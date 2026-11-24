import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";

/**
 * What the person chose: whether Peal's web app may link what they do in
 * it to their account and record their sessions.
 */
export const BrowserAnalyticsChoiceSchema = Schema.Literals([
  "granted",
  "refused",
]).annotate({ identifier: "BrowserAnalyticsChoice" });

export type BrowserAnalyticsChoice = typeof BrowserAnalyticsChoiceSchema.Type;

/** How many days a choice stands before the person is asked again. */
export const browserAnalyticsConsentDays = 183;

/**
 * How the web app measures its use for the signed-in person, where the
 * server measures it.
 */
export const BrowserAnalyticsSchema = Schema.Struct({
  // The product analytics project's token: public by design, it only
  // writes events.
  token: Schema.String,
  // The `environment` of every event.
  environment: Schema.String,
  // The person's choice, `undecided` until they made one and again once it
  // is older than `browserAnalyticsConsentDays`.
  consent: Schema.Literals(["undecided", "granted", "refused"]),
  // When they made it; null while undecided.
  decidedAt: Schema.NullOr(Schema.DateTimeUtc),
  // The person's workspaces whose pages the web app measures nothing of.
  excludedWorkspaceIds: Schema.Array(Schema.String),
}).annotate({ identifier: "BrowserAnalytics" });

export type BrowserAnalytics = typeof BrowserAnalyticsSchema.Type;

/** The choice to keep. */
export const BrowserAnalyticsConsentChangeSchema = Schema.Struct({
  choice: BrowserAnalyticsChoiceSchema,
}).annotate({ identifier: "BrowserAnalyticsConsentChange" });

export type BrowserAnalyticsConsentChange =
  typeof BrowserAnalyticsConsentChangeSchema.Type;

/** The choice kept, and when. */
export const BrowserAnalyticsConsentSchema = Schema.Struct({
  consent: BrowserAnalyticsChoiceSchema,
  decidedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "BrowserAnalyticsConsent" });

export type BrowserAnalyticsConsent = typeof BrowserAnalyticsConsentSchema.Type;

/** The signed-in person's choice about how the web app measures its use. */
export class BrowserAnalyticsApi extends HttpApiGroup.make(
  "me.browserAnalytics"
)
  .add(
    HttpApiEndpoint.put("setConsent", "/consent", {
      error: [Forbidden],
      payload: BrowserAnalyticsConsentChangeSchema,
      success: BrowserAnalyticsConsentSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Records whether the signed-in person allows Peal's web app to link what they do in it to their account and to record their sessions, where the server measures the web app's use, and answers with the choice and when it was made. The choice is kept whether or not the server measures. Only the person in their own session sets it: an API key, an OAuth client and staff acting as the person get 403.",
        summary: "Set the web app's measurement consent",
      })
    )
  )
  .middleware(Authentication)
  .prefix("/api/me/browser-analytics") {}
