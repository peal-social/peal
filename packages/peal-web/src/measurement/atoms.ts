import { PealApi } from "#api/client.ts";

/** Keeps the person's choice about how the web app measures its use. */
export const setBrowserAnalyticsConsent = PealApi.mutation(
  "me.browserAnalytics",
  "setConsent"
);
