import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelRecord } from "#shared/application/personal-data.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/**
 * A workspace's channels as a whole, and the connections a user has in
 * progress, for the workspace context when a workspace's or a user's data is
 * exported or erased. Erasing runs in the caller's transaction, if any.
 */
export class ChannelRecords extends Context.Service<
  ChannelRecords,
  {
    /** The workspace's channels, oldest first, without their tokens. */
    readonly exportWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<readonly ChannelRecord[], DatabaseError>;
    /**
     * Deletes the workspace's channels, their encrypted tokens (with the
     * Facebook user a Page's rests on, `granted_by`), the connections and
     * account choices in progress, and its connect links: nothing posts
     * there any more, and no link opens it.
     */
    readonly eraseWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * Deletes the connections and account choices the user started, in
     * every workspace, with the tokens a choice holds. The channels they
     * connected belong to their workspaces, and stay, as the connect links
     * they created do, without them.
     */
    readonly eraseUser: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    /**
     * Before the workspaces' erasure, outside its transaction: what their
     * channels set up on their platforms for Peal is undone with the
     * tokens they hold (ChannelDepartures: Meta's message events), every
     * channel of them counted as leaving with it. The channels go side by
     * side, under one bound for them all, so an erasure never waits on a
     * platform once a channel. Best effort: it never fails, and a
     * channel's own failure is logged by its id.
     */
    readonly releaseWorkspaces: (
      workspaceIds: readonly WorkspaceId[]
    ) => Effect.Effect<void>;
  }
>()("peal-server/channels/application/ChannelRecords") {}
