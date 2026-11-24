import { HttpApiMiddleware } from "effect/http-api";

import type { CurrentMember } from "./current-member.ts";
import type { CurrentPrincipal } from "./current-principal.ts";
import { Forbidden } from "./forbidden.ts";
import { WorkspaceNotFound } from "./workspace-not-found.ts";
import { WorkspaceRequired } from "./workspace-required.ts";

/**
 * The caller as a member of the workspace the request acts in: the one its
 * `Peal-Workspace` header names (`workspaceHeaders`), else the credential's
 * own (an API key's, or the workspace an application's token is bound to).
 * A request that names none, with a credential that belongs to none (a
 * session, the command line's sign-in, a partner key), is refused
 * (`WorkspaceRequired`). Put it on workspace groups before Authentication,
 * which runs first: `.middleware(WorkspaceAccess).middleware(Authentication)`.
 */
export class WorkspaceAccess extends HttpApiMiddleware.Service<
  WorkspaceAccess,
  { provides: CurrentMember; requires: CurrentPrincipal }
>()("peal-contract/WorkspaceAccess", {
  error: [Forbidden, WorkspaceNotFound, WorkspaceRequired],
}) {}
