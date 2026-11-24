import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";
import { WorkspaceSecuritySchema } from "./workspaces.ts";

/**
 * What a workspace requires of its members, which any member, application
 * or API key of the workspace may read. Changing it is an owner's, in their
 * own session (`workspace.secure`, in WorkspacesApi).
 */
export class WorkspaceSecurityApi extends HttpApiGroup.make(
  "workspace.security"
)
  .add(
    HttpApiEndpoint.get("get", "/security", {
      error: [Forbidden],
      headers: workspaceHeaders,

      success: WorkspaceSecuritySchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Answers whether the workspace requires two-step verification of every member, and, to a member who may manage members (member:update), how many members' accounts do not have it on. Any member, application or API key of the workspace may read it.",
        summary: "Get the workspace's security policy",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/workspace") {}
