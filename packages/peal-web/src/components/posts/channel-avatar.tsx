import type { SocialChannel } from "peal-contract";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "peal-ui/components/avatar";

import { channelInitial } from "#channels/channel-name.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";

type Pictured = Pick<
  SocialChannel,
  "avatarUrl" | "displayName" | "handle" | "id" | "label" | "platform"
>;

const ChannelPicture = ({ channel }: { readonly channel: Pictured }) => (
  <Avatar size="sm">
    {channel.avatarUrl === null ? null : (
      <AvatarImage src={channel.avatarUrl} alt="" />
    )}
    <AvatarFallback>{channelInitial(channel)}</AvatarFallback>
  </Avatar>
);

/**
 * A channel's picture, or its initial, small; with `marked`, its
 * platform's mark at its corner, as the Channels page shows it. It names
 * nothing: the channel's name is written beside it.
 */
export const ChannelAvatar = ({
  channel,
  marked = false,
}: {
  readonly channel: Pictured;
  readonly marked?: boolean;
}) => (
  <span aria-hidden="true" className="relative flex shrink-0">
    <ChannelPicture channel={channel} />
    {marked ? (
      <span className="absolute -end-1.5 -bottom-1">
        <PlatformMark platform={channel.platform} size="badge" />
      </span>
    ) : null}
  </span>
);

// How many pictures a stack shows before the count says the rest.
const stacked = 3;

/**
 * The first channels' pictures, overlapping, as a property shows who it
 * holds; the words beside it say how many.
 */
export const ChannelAvatarStack = ({
  channels,
}: {
  readonly channels: readonly Pictured[];
}) => (
  <AvatarGroup aria-hidden="true">
    {channels.slice(0, stacked).map((channel) => (
      <ChannelPicture key={channel.id} channel={channel} />
    ))}
  </AvatarGroup>
);
