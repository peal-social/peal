import { Schema } from "effect";

import {
  AiCapabilitySchema,
  ConnectedProviderIdSchema,
} from "./ai-capability.ts";
import { ProviderModelSchema } from "./image-provider.ts";

/**
 * What a workspace chose for one of its uses: a provider it connected
 * that offers it, and the model asked, with when it was saved.
 */
export class CapabilityModelSettings extends Schema.Class<CapabilityModelSettings>(
  "peal-server/assistant/domain/CapabilityModelSettings"
)({
  capability: AiCapabilitySchema,
  model: ProviderModelSchema,
  provider: ConnectedProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}) {}
