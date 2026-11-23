import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Connecting a provider without `apiKey`, while the workspace has no key
 * stored for it that opens, or with another address than the one the
 * stored key was typed for. Nothing was saved.
 */
export class AiProviderKeyRequired extends Schema.TaggedError<AiProviderKeyRequired>()(
  "AiProviderKeyRequired",
  { ...errorEnvelope },
  {
    description:
      "The workspace has no key stored for this provider, its stored key can no longer be read, or the new `baseUrl` is not the address the key was typed for (any change of host or path counts): a key is never sent to another address. Send `apiKey` in the same request. Nothing was saved.",
    httpApiStatus: 422,
  }
) {}
