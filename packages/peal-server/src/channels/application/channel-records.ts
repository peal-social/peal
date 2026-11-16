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
     * Before the workspace's erasure, outside its transaction: what its
     * channels set up on their platforms for Peal is undone with the
     * tokens they hold (ChannelDepartures: Meta's message events), every
     * channel of the workspace counted as leaving with it. Best effort: it
     * never fails, and a channel's own failure is logged by its id.
     */
    readonly releaseWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void>;
  }
>()("peal-server/channels/application/ChannelRecords") {}
