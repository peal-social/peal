import { Schema } from "effect";

import { LocalDateSchema } from "#shared/domain/wall-clock.ts";

import { NetworkObjectIdSchema } from "./ids.ts";
import { CountSchema } from "./insight-day.ts";
import { MicrosSchema } from "./money.ts";

/**
 * What one campaign did on one day of its account's calendar, on a
 * network whose numbers are read by campaign (`networkTraits`' `days`):
 * counts and money, never who saw an ad. No reach and no results.
 */
export class CampaignDay extends Schema.Class<CampaignDay>(
  "peal-server/ads/domain/CampaignDay"
)({
  campaignExternalId: NetworkObjectIdSchema,
  clicks: CountSchema,
  day: LocalDateSchema,
  impressions: CountSchema,
  /**
   * What the day cost, in micros of the account's currency, as Google
   * writes it: rounded to the minor unit only where days are summed, once.
   */
  spendMicros: MicrosSchema,
}) {}
