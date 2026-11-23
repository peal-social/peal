import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";
import { ImageProviderAddressRefusalSchema } from "./image-provider-address-refused.ts";

/**
 * The address given for a provider the workspace connects is not one
 * Peal sends a key to, for the reasons an image provider's is refused
 * (`ImageProviderAddressRefusal`).
 */
export class AiProviderAddressRefused extends Schema.TaggedError<AiProviderAddressRefused>()(
  "AiProviderAddressRefused",
  { ...errorEnvelope, reason: ImageProviderAddressRefusalSchema },
  {
    description:
      "Peal sends a workspace's drafts, prompts and key only to a public HTTPS address on the default port, without a user name, a password, a query or a fragment, at most 2048 characters long: `reason` says what this one is not. Nothing was saved.",
    httpApiStatus: 422,
  }
) {}
