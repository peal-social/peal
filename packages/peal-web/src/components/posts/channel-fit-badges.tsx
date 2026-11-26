"use client";

import { useTranslations } from "next-intl";
import { Badge } from "peal-ui/components/badge";

import { MediaFitBadges } from "#components/posts/media-fit-badges.tsx";
import { useMediaProblemText } from "#components/posts/media-text.ts";
import type { ChannelFit, ChannelProblem } from "#posts/character-count.ts";
import type { MediaFit } from "#posts/media-fit.ts";

const countsOf = (problem: ChannelProblem) => {
  if (problem._tag === "forbiddenCharacters") {
    return { characters: problem.characters.join(" "), count: 0, maximum: 0 };
  }

  return problem._tag === "empty" || problem._tag === "mediaRequired"
    ? { characters: "", count: 0, maximum: 0 }
    : { characters: "", count: problem.count, maximum: problem.maximum };
};

/**
 * What one channel's platform would refuse in the post, in words: its
 * text's, then its images' and videos' (`unwritten`: "nothing to publish"
 * left out while nothing is written), as a row says them in a line.
 */
export const useFitProblems = () => {
  const t = useTranslations("Posts.Composer");
  const mediaText = useMediaProblemText();

  return (
    fit: ChannelFit,
    media: MediaFit | undefined,
    unwritten: boolean
  ): readonly string[] => [
    ...fit.problems
      .filter(({ _tag }) => !(unwritten && _tag === "empty"))
      .map((problem) =>
        t("problem", { ...countsOf(problem), problem: problem._tag })
      ),
    ...(media?.problems ?? []).map(mediaText),
  ];
};

/**
 * What one channel's platform would refuse in the post (its text, then its
 * images and videos), then how long its text is against the platform's
 * closest limit. `quiet` leaves out the words for a platform with no limit
 * known, where a row has little room.
 */
export const ChannelFitBadges = ({
  fit,
  media,
  quiet = false,
  unwritten = false,
}: {
  readonly fit: ChannelFit;
  /** How the post's images and videos fit, when it has any. */
  readonly media?: MediaFit | undefined;
  readonly quiet?: boolean;
  /**
   * Nothing is written yet: "nothing to publish" goes without saying, and
   * is left out.
   */
  readonly unwritten?: boolean;
}) => {
  const t = useTranslations("Posts.Composer");
  const { tightest } = fit;

  const noLimit = quiet ? null : (
    <span className="text-muted-foreground">{t("noLimit")}</span>
  );

  const counter =
    tightest === undefined ? (
      noLimit
    ) : (
      <Badge variant={tightest.remaining < 0 ? "destructive" : "outline"}>
        {t("count", {
          length: tightest.length,
          maximum: tightest.maximum,
          unit: tightest.unit,
        })}
      </Badge>
    );

  return (
    <>
      {fit.problems
        .filter(({ _tag }) => !(unwritten && _tag === "empty"))
        .map((problem) => (
          <Badge key={problem._tag} variant="destructive">
            {t("problem", { ...countsOf(problem), problem: problem._tag })}
          </Badge>
        ))}
      {media === undefined ? null : <MediaFitBadges fit={media} />}
      {counter}
    </>
  );
};
