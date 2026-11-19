import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId } from "#shared/domain/ids.ts";
import type { BrowserAnalyticsConsent } from "#workspace/domain/browser-analytics-consent.ts";

/**
 * Where a person's choice about the web app's measurement is kept: on
 * their account, beside their language, so it follows them across
 * browsers and is the proof of what they chose.
 */
export class BrowserAnalyticsConsents extends Context.Service<
  BrowserAnalyticsConsents,
  {
    /** Keeps the choice and its date, replacing any before. */
    readonly keep: (
      userId: UserId,
      consent: BrowserAnalyticsConsent
    ) => Effect.Effect<void, DatabaseError>;
    /** The choice kept, none until one was made. */
    readonly read: (
      userId: UserId
    ) => Effect.Effect<Option.Option<BrowserAnalyticsConsent>, DatabaseError>;
  }
>()("peal-server/workspace/application/BrowserAnalyticsConsents") {}
