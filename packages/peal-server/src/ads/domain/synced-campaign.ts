import { Schema } from "effect";

import {
  objectBudget,
  objectName,
  objectSchedule,
  objectStatus,
  CampaignObjectiveSchema,
} from "./ad-object.ts";
import { NetworkObjectIdSchema } from "./ids.ts";

/** A campaign as its network describes it. */
export class SyncedCampaign extends Schema.Class<SyncedCampaign>(
  "peal-server/ads/domain/SyncedCampaign"
)({
  ...objectStatus,
  ...objectBudget,
  ...objectSchedule,
  externalId: NetworkObjectIdSchema,
  /**
   * The network's own word for the campaign's kind (`SEARCH`,
   * `PERFORMANCE_MAX` on Google Ads); none where the objective says it all.
   */
  kind: Schema.Option(Schema.String.check(Schema.isMaxLength(64))),
  name: objectName,
  objective: CampaignObjectiveSchema,
}) {}
