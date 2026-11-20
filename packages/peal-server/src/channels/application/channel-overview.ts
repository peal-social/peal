import { Context, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

import { ChannelOverviewReads } from "./channel-overview-reads.ts";
import type { ChannelStateCounts } from "./channel-overview-reads.ts";

export type { ChannelStateCounts } from "./channel-overview-reads.ts";

/**
 * The channels of several workspaces at once, for a partner's view of its
 * customers: each one's channels by status. Counts only, so it checks no
 * permission: the caller decided which workspaces may be read.
 */
export class ChannelOverview extends Context.Service<
  ChannelOverview,
  {
    /** Each workspace's counts; one without any channel is left out. */
    readonly statesIn: (
      workspaceIds: readonly WorkspaceId[]
    ) => Effect.Effect<
      ReadonlyMap<WorkspaceId, ChannelStateCounts>,
      DatabaseError
    >;
  }
>()("peal-server/channels/application/ChannelOverview") {
  static readonly layer = Layer.effect(
    ChannelOverview,
    Effect.gen(function* ChannelOverviewLive() {
      const reads = yield* ChannelOverviewReads;

      return ChannelOverview.of({
        statesIn: (workspaceIds) =>
          (workspaceIds.length === 0
            ? Effect.succeed(new Map<WorkspaceId, ChannelStateCounts>())
            : reads.statesIn(workspaceIds)
          ).pipe(Effect.withSpan("ChannelOverview.statesIn")),
      });
    })
  );
}
