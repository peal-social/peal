import { useTranslations } from "next-intl";
import type { Channel } from "peal-contract";

import { channelName } from "#channels/channel-name.ts";

/** What a picker reads of a channel to name it. */
export type Labelled = Pick<Channel, "handle" | "label" | "platform">;

/**
 * How a picker names a channel (a select's option, a Filter menu's value
 * and its chip, a box to tick): its name with its handle, then its
 * platform's ("Client A (@clienta) on Instagram"), as the post's page
 * names one. Two channels of one name on two platforms read apart, and a
 * search finds a channel by its platform's name.
 */
export const useChannelLabel = (): ((channel: Labelled) => string) => {
  const t = useTranslations("Posts");

  return (channel) =>
    t("Composer.channelDetail", {
      handle: channelName(channel),
      platform: t("platform", { platform: channel.platform }),
    });
};
