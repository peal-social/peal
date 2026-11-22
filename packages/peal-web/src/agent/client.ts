import { AtomHttpApi } from "effect/reactivity";
import { AgentApi } from "peal-contract/agent";

import { apiBaseUrl, fetchFrom } from "#api/client.ts";

// The agent's typed client, derived from `peal-contract/agent`: apart from
// `PealApi`, as the agent is apart from `Api`. Browsers call `/api`, which
// Next forwards to the server, as for every other endpoint.
export class PealAgentApi extends AtomHttpApi.Service<PealAgentApi>()(
  "peal-web/PealAgentApi",
  {
    api: AgentApi,
    httpClient: (get) => fetchFrom(get(apiBaseUrl)),
  }
) {}
