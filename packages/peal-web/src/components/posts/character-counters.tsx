"use client";

import { useTranslations } from "next-intl";
import type { SocialChannel } from "peal-contract";

import { channelName } from "#channels/channel-name.ts";
import { ChannelFitBadges } from "#components/posts/channel-fit-badges.tsx";
import { fits as takesPost } from "#posts/character-count.ts";
import type { ChannelFit } from "#posts/character-count.ts";
import { mediaFits } from "#posts/media-fit.ts";
import type { MediaFit } from "#posts/media-fit.ts";

interface CharacterCountersProps {
  readonly fits: readonly {
    readonly channel: SocialChannel;
    readonly fit: ChannelFit;
    /** How the post's images and videos fit, when it has any. */
    readonly media?: MediaFit;
  }[];
}

/**
 * How many of these channels would refuse the post as it is, for screen
 * readers, who hear it only when that number changes: the counts change
 * with every key, so they are not announced.
 */
export const FitSummary = ({ fits }: CharacterCountersProps) => {
  const t = useTranslations("Posts.Composer");

  const refusing = fits.filter(
    ({ fit, media }) =>
      !takesPost(fit) || (media !== undefined && !mediaFits(media))
  ).length;

  return (
    <output className="sr-only">{t("fitSummary", { count: refusing })}</output>
  );
};

// For each channel the post goes to, how long its text is against the
// platform's closest limit, and what else the platform would refuse, its
// images and videos included, with `FitSummary` for screen readers.
export const CharacterCounters = ({ fits }: CharacterCountersProps) => {
  const t = useTranslations("Posts.Composer");
  const tPosts = useTranslations("Posts");
  const tFormats = useTranslations("Posts.Formats");

  if (fits.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("countersEmpty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FitSummary fits={fits} />
      <ul className="flex flex-col gap-2">
        {fits.map(({ channel, fit, media }) => (
          <li
            key={channel.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="truncate">
              {t("channelDetail", {
                handle: channelName(channel),
                platform: tPosts("platform", { platform: channel.platform }),
              })}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <ChannelFitBadges fit={fit} media={media} />
            </span>
          </li>
        ))}
      </ul>
      {fits.some(({ fit }) => fit.textNotSent === true) ? (
        <p className="text-muted-foreground text-sm">
          {tFormats("textNotSent")}
        </p>
      ) : null}
    </div>
  );
};
