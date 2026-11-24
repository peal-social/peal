import { Match } from "effect";
import type { PostOrigin as OriginView } from "peal-contract";

import type { PostOrigin } from "#publishing/domain/post-origin.ts";

/**
 * How the starter of what acts later (a rule, a feed) reached Peal, as a
 * post's origin is shown.
 */
export const originView = (origin: PostOrigin): OriginView =>
  Match.valueTags(origin, {
    apiKey: ({ apiKeyId, name }) => ({
      id: apiKeyId,
      name: name ?? null,
      via: "apiKey" as const,
    }),
    application: ({ clientId, name }) => ({
      id: clientId,
      name: name ?? null,
      via: "application" as const,
    }),
    web: () => ({ id: null, name: null, via: "web" as const }),
  });
