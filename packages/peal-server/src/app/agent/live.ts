import { BunDns } from "@effect/platform-bun";
import { Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { AgentApi } from "peal-contract/agent";

import { AgentDeskLive } from "#agent/container.ts";
import { AgentHandlers } from "#app/agent/handlers.ts";
import { AgentLanguageModelsLive } from "#app/agent/language-models.ts";
import { AgentToolboxLive } from "#app/agent/toolbox.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { WorkspaceApiLive } from "#workspace/container.ts";

// The agent's use cases, on the MCP endpoint's tools and the assistant's
// providers. Built with the routes, as the MCP endpoint is, since its tools
// reach every context's use cases.
const AgentDeskWithToolsLive = AgentDeskLive.pipe(
  Layer.provide(AgentToolboxLive),
  Layer.provide(AgentLanguageModelsLive),
  Layer.provide(IdsLive),
  // The outbound guard checks a workspace's own provider's address.
  Layer.provide(BunDns.layer)
);

/**
 * The agent's endpoints (`AgentApi`), beside `Api` under
 * `/api/v1/agent`, behind the same Authentication and
 * WorkspaceAccess: its use cases, its tools (the MCP endpoint's handlers)
 * and its language models. Not in the OpenAPI document.
 */
export const AgentApiLive = HttpApiBuilder.layer(AgentApi).pipe(
  Layer.provide(AgentHandlers.pipe(Layer.provide(AgentDeskWithToolsLive))),
  Layer.provide(WorkspaceApiLive)
);
