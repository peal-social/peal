import { Schema } from "effect";

import { ConnectedProviderIdSchema } from "./ai-capability.ts";
import { ProviderAddressSchema } from "./image-provider.ts";

/**
 * A provider a workspace connected: which one, where it is reached (its
 * own address, or a proxy's) and when it was saved. Its key is kept
 * apart, sealed, and never part of it. What it is used for is the
 * workspace's choice of a model for each use.
 */
export class ProviderConnectionSettings extends Schema.Class<ProviderConnectionSettings>(
  "peal-server/assistant/domain/ProviderConnectionSettings"
)({
  baseUrl: ProviderAddressSchema,
  provider: ConnectedProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}) {}
