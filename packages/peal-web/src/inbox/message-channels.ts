import type { SocialChannel } from "peal-contract";

/**
 * Whether Peal reads none of the channel's direct messages whatever the
 * switch says: an Instagram account connected through a business
 * portfolio (Meta's Unified login), whose messages the server refuses as
 * `unsupported` until it reads them through that way in.
 */
export const readsNoMessages = (channel: SocialChannel): boolean =>
  channel.platform === "instagram" && channel.connection === "unifiedLogin";
