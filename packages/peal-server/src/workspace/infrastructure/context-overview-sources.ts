import { Effect, Layer } from "effect";

import { WorkspaceStanding } from "#billing/application/workspace-standing.ts";
import { ChannelOverview } from "#channels/application/channel-overview.ts";
import { InboxWaiting } from "#engagement/application/inbox-waiting.ts";
import { PostAttention } from "#publishing/application/post-attention.ts";
import { OverviewSources } from "#workspace/application/overview-sources.ts";

/**
 * What a partner's overview of its customers reads of the other contexts,
 * through their application layers: publishing's posts, the channels
 * context's channels, the inbox's waiting threads and billing's standing:
 * one read each for a page, whatever its number of workspaces.
 */
export const ContextOverviewSourcesLive = Layer.effect(
  OverviewSources,
  Effect.gen(function* ContextOverviewSourcesLive() {
    const posts = yield* PostAttention;
    const channels = yield* ChannelOverview;
    const inbox = yield* InboxWaiting;
    const standing = yield* WorkspaceStanding;

    return OverviewSources.of({
      bills: standing.bills,
      channels: (workspaceIds) => channels.statesIn(workspaceIds),
      overPlan: (workspaceIds) => standing.overPlanIn(workspaceIds),
      posts: (workspaceIds, now) => posts.countsIn(workspaceIds, now),
      unanswered: (workspaceIds) => inbox.unansweredIn(workspaceIds),
    });
  })
);
