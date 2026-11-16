import type { Option } from "effect";

import type { LocalDate } from "#shared/domain/wall-clock.ts";

import type { CampaignDay } from "./campaign-day.ts";
import type { InsightDay } from "./insight-day.ts";
import type { SyncedAdSet } from "./synced-ad-set.ts";
import type { SyncedAd } from "./synced-ad.ts";
import type { SyncedCampaign } from "./synced-campaign.ts";

/** Everything a sync read of one account. */
export interface AccountSnapshot {
  readonly adSets: readonly SyncedAdSet[];
  readonly ads: readonly SyncedAd[];
  /** Each campaign's days, on a network that reads them by campaign. */
  readonly campaignDays: readonly CampaignDay[];
  /**
   * The days whose campaign numbers were read whole, both included: a
   * campaign's day in them that was not listed did nothing (the network
   * leaves out a day whose numbers are all zero), and replaces what was
   * kept of it. None when they were not read whole, and on Meta.
   */
  readonly campaignDaysCover: Option.Option<{
    readonly from: LocalDate;
    readonly to: LocalDate;
  }>;
  readonly campaigns: readonly SyncedCampaign[];
  readonly insights: readonly InsightDay[];
}
