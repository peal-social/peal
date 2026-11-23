"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Slideshow, VideoGeneration } from "peal-contract";

/** A video on its way, as the library shows it in its place. */
export const VideoJobTileView = ({
  job,
}: {
  readonly job: Pick<VideoGeneration, "aspect" | "status">;
}) => {
  const t = useTranslations("Assistant.videos");
  const images = useTranslations("Assistant.images");

  return (
    <li className="flex flex-col gap-2">
      <div className="bg-muted text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <LoaderCircleIcon aria-hidden className="size-6 animate-spin" />
        <span className="text-sm">{t("state", { status: job.status })}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        {images("aspects", { aspect: job.aspect })}
      </p>
    </li>
  );
};

/** The library's videos on their way, as placeholders; nothing without one. */
export const VideoJobsView = ({
  jobs,
}: {
  readonly jobs: readonly VideoGeneration[];
}) => {
  const t = useTranslations("Assistant.videos");

  return jobs.length === 0 ? null : (
    <section className="flex flex-col gap-2" aria-labelledby="video-jobs">
      <h3 id="video-jobs" className="text-sm font-medium">
        {t("jobs")}
      </h3>
      <ul
        aria-live="polite"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      >
        {jobs.map((job) => (
          <VideoJobTileView key={job.id} job={job} />
        ))}
      </ul>
    </section>
  );
};

/** A slide video on its way, as the library shows it in its place. */
export const SlideshowJobTileView = ({
  job,
}: {
  readonly job: Pick<Slideshow, "aspect" | "imageMediaIds" | "status">;
}) => {
  const t = useTranslations("Assistant.slideshows");
  const images = useTranslations("Assistant.images");

  return (
    <li className="flex flex-col gap-2">
      <div className="bg-muted text-muted-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
        <LoaderCircleIcon aria-hidden className="size-6 animate-spin" />
        <span className="text-sm">{t("state", { status: job.status })}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("tile", {
          aspect: images("aspects", { aspect: job.aspect }),
          slides: job.imageMediaIds.length,
        })}
      </p>
    </li>
  );
};

/** The library's slide videos on their way, as placeholders; nothing without one. */
export const SlideshowJobsView = ({
  jobs,
}: {
  readonly jobs: readonly Slideshow[];
}) => {
  const t = useTranslations("Assistant.slideshows");

  return jobs.length === 0 ? null : (
    <section className="flex flex-col gap-2" aria-labelledby="slideshow-jobs">
      <h3 id="slideshow-jobs" className="text-sm font-medium">
        {t("jobs")}
      </h3>
      <ul
        aria-live="polite"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      >
        {jobs.map((job) => (
          <SlideshowJobTileView key={job.id} job={job} />
        ))}
      </ul>
    </section>
  );
};
