import { Config, Effect, Option, Redacted } from "effect";

import { InvalidAdsSettings } from "#ads/infrastructure/invalid-ads-settings.ts";

import type { GoogleAdsClientSettings } from "./google-ads-client.ts";

const nonBlank = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Config.map(Option.map((value) => value.trim())),
    Config.map(Option.filter((value) => value !== ""))
  );

const nonBlankRedacted = (name: string) =>
  Config.option(Config.Redacted(name)).pipe(
    Config.map(Option.filter((value) => Redacted.value(value).trim() !== ""))
  );

/**
 * The operator's OAuth client for Google Ads (`GOOGLE_ADS_CLIENT_ID`,
 * `GOOGLE_ADS_CLIENT_SECRET`), a web application client of a Cloud
 * project with the Google Ads API enabled: the project's access level is
 * what Google reads for (Test reads test accounts only). None when both
 * are unset; one without the other stops the server. No developer token:
 * Google retired them on 9 September 2026.
 */
export const googleAdsClientConfig = Effect.gen(function* googleAdsClient() {
  const clientId = yield* nonBlank("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = yield* nonBlankRedacted("GOOGLE_ADS_CLIENT_SECRET");

  if (Option.isNone(clientId) && Option.isNone(clientSecret)) {
    return Option.none<GoogleAdsClientSettings>();
  }

  if (Option.isNone(clientId) || Option.isNone(clientSecret)) {
    return yield* new InvalidAdsSettings({
      reason: "GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET go together",
    });
  }

  const settings: GoogleAdsClientSettings = {
    clientId: clientId.value,
    clientSecret: clientSecret.value,
  };

  return Option.some(settings);
});
