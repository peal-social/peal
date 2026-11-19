import { DateTime, Duration, Option, Schema } from "effect";

/**
 * Whether the person allows the web app to link what they do in it to
 * their account and to record their sessions.
 */
export const BrowserAnalyticsChoiceSchema = Schema.Literals([
  "granted",
  "refused",
]);

export type BrowserAnalyticsChoice = typeof BrowserAnalyticsChoiceSchema.Type;

/** The person's choice, and when they made it, on the server's clock. */
export const BrowserAnalyticsConsentSchema = Schema.Struct({
  choice: BrowserAnalyticsChoiceSchema,
  decidedAt: Schema.DateTimeUtc,
});

export type BrowserAnalyticsConsent = typeof BrowserAnalyticsConsentSchema.Type;

/**
 * How long a choice stands, a consent as a refusal, before the person is
 * asked again: six months, as CNIL calls good practice (the contract's
 * `browserAnalyticsConsentDays`, kept equal by a test).
 */
export const consentStandsFor = Duration.days(183);

/** The choice that still stands at `now`: none once it is too old. */
export const standingConsent = (
  consent: Option.Option<BrowserAnalyticsConsent>,
  now: DateTime.Utc
): Option.Option<BrowserAnalyticsConsent> =>
  consent.pipe(
    Option.filter(({ decidedAt }) =>
      DateTime.isLessThan(
        now,
        DateTime.addDuration(decidedAt, consentStandsFor)
      )
    )
  );
