import { Context } from "effect";
import type { Effect, Scope } from "effect";

import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * The probes of uploaded files under way: each reads its file for up to a
 * minute, holding part of it, so a workspace runs so many at once, and the
 * server so many in all (`probesAtOnce`).
 */
export class ProbeSlots extends Context.Service<
  ProbeSlots,
  {
    /**
     * Takes a slot for the workspace, kept for the scope: false when the
     * workspace, or the server, already runs as many probes as it may.
     */
    readonly take: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<boolean, never, Scope.Scope>;
  }
>()("peal-server/media/application/ProbeSlots") {}
