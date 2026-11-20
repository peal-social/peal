import type { ChannelConnection } from "peal-contract";

/**
 * What signing in again for a new choice of accounts starts with: the way
 * in the choice came through, as the server answered it with the choice,
 * so a member choosing LinkedIn pages is not sent to connect their
 * profile, nor one choosing the Instagram accounts of a business portfolio
 * to a Facebook Page's sign-in. Nothing on a platform with one way in.
 */
export const choiceStart = (
  connection: ChannelConnection | null
): { readonly connection?: ChannelConnection } =>
  connection === null ? {} : { connection };
