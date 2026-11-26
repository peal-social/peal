import type { Channel } from "#channels/domain/channel.ts";
import { isSocialPlatform } from "#channels/domain/platform.ts";
import type { SocialPlatform } from "#shared/domain/platform.ts";

/** A channel of a social network or a chat: no website's. */
export type SocialChannel = Channel & { readonly platform: SocialPlatform };

/**
 * Whether the channel is a social network's or a chat's rather than a
 * website's: analytics, the inbox, connect links, the channel directory
 * and channel moves leave a website's out.
 */
export const isSocialChannel = (channel: Channel): channel is SocialChannel =>
  isSocialPlatform(channel.platform);
