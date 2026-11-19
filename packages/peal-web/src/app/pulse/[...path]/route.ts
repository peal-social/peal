import { Effect } from "effect";

import { relayToPostHog } from "#measurement/relay.ts";

// The web app's measurement, relayed to PostHog (src/measurement/relay.ts):
// its settings are read per request, never at build time.
export const dynamic = "force-dynamic";

const relay = async (request: Request): Promise<Response> =>
  await Effect.runPromise(relayToPostHog(request, fetch));

export const GET = relay;

export const POST = relay;
