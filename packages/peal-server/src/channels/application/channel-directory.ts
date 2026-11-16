import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { Platform } from "#channels/domain/platform.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelConnection } from "#shared/domain/channel-connection.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";

/** A connected channel, by what places it: ids and its platform. */
export interface ListedChannel {
  readonly channelId: ChannelId;
  readonly platform: Platform;
  readonly workspaceId: WorkspaceId;
}

/**
 * A channel of an account, with the way in it came through (Instagram's
 * two logins), which decides the app whose subscription carries its
 * events.
 */
export interface AccountListedChannel extends ListedChannel {
  readonly connection: Option.Option<ChannelConnection>;
}

/**
 * Every connected channel of every workspace, in the order of their ids, a
 * page at a time, for the contexts that follow channels as a whole, such
 * as analytics: ids and platforms, never a token, a handle or a name, and
 * of social networks only, as none of them follows a website. It
 * checks no permission: jobs call it, never a request.
 */
export class ChannelDirectory extends Context.Service<
  ChannelDirectory,
  {
    /** At most `limit` channels after `after`, or from the first. */
    readonly after: (
      after: Option.Option<ChannelId>,
      limit: number
    ) => Effect.Effect<readonly ListedChannel[], DatabaseError>;
    /**
     * The channels of the account with this id on the platform, one a
     * workspace that connected it, in the order of their ids: where a
     * platform's event about the account goes.
     */
    readonly withAccount: (
      platform: Platform,
      accountId: string
    ) => Effect.Effect<readonly AccountListedChannel[], DatabaseError>;
  }
>()("peal-server/channels/application/ChannelDirectory") {}
