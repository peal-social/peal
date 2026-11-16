import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";

/** A platform whose events name the accounts they concern. */
export type EventPlatform = "facebook" | "instagram";

/** A connected channel of an account: where its events go. */
export interface AccountChannel {
  readonly channelId: ChannelId;
  readonly workspaceId: WorkspaceId;
}

/**
 * The connected channels of an account on its platform, from the channels
 * context: one a workspace that connected it. Ids only. It checks no
 * permission: a platform's signed event calls it, never a member.
 */
export class MessageChannelsOfAccount extends Context.Service<
  MessageChannelsOfAccount,
  {
    readonly channelsOf: (
      platform: EventPlatform,
      accountId: string
    ) => Effect.Effect<readonly AccountChannel[], DatabaseError>;
  }
>()("peal-server/engagement/application/MessageChannelsOfAccount") {}
