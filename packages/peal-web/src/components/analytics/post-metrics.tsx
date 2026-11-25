"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Cause, DateTime, Option, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useFormatter, useTranslations } from "next-intl";
import { Forbidden, postCountsReadForDays } from "peal-contract";
import type {
  Platform,
  PlatformCapabilities,
  Post,
  PostAnalytics,
  PostTarget,
  SocialChannel,
} from "peal-contract";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import { useEffect, useRef } from "react";

import { platformCapabilities, postAnalytics } from "#analytics/api.ts";
import { countsRowsOf, likelyCharted } from "#analytics/post-counts.ts";
import type { CountsRow, EndReason } from "#analytics/post-counts.ts";
import { MetricList } from "#components/analytics/metric-list.tsx";
import { ReadingsChart } from "#components/analytics/readings-chart.tsx";
import { InTimeZone } from "#components/notices/in-time-zone.tsx";
import { browserTimeZone } from "#posts/zoned-time.ts";

/**
 * The platforms a server reads each post's counts on, from its
 * capabilities, in the order it lists them.
 */
export const countedOn = (
  capabilities: readonly Pick<PlatformCapabilities, "analytics" | "platform">[]
): readonly Platform[] =>
  capabilities.flatMap(({ analytics, platform }) =>
    analytics.perPost ? [platform] : []
  );

/** Names a channel as the post's page does: its name and its platform. */
export type ChannelNamer = (channelId: string | undefined) => string;

interface PostMetricsViewProps {
  readonly analytics: PostAnalytics;
  readonly channelName: ChannelNamer;
  readonly channels: readonly SocialChannel[];
  /**
   * The platforms this server reads counts on, as its capabilities say
   * (`countedOn`): X only where its operator turned X reads on. Undefined
   * when they could not be read: then no count is promised.
   */
  readonly counted: readonly Platform[] | undefined;
  readonly now: DateTime.Utc;
  /** The post's targets, in its order. */
  readonly targets: readonly PostTarget[];
}

const CountsRowView = ({
  channelName,
  row,
}: {
  readonly channelName: ChannelNamer;
  readonly row: CountsRow;
}) => {
  const t = useTranslations("Analytics");
  const tPosts = useTranslations("Posts");
  const tFormats = useTranslations("Posts.Formats");
  const format = useFormatter();
  const { state } = row;
  const name = channelName(row.channelId);

  const endedText = (reason: EndReason) =>
    t("post.ended", { days: postCountsReadForDays, reason });

  const aside = (() => {
    if (state._tag === "read") {
      return state.tracked.lastCollectedAt === null
        ? null
        : t("post.readAt", {
            at: format.dateTime(
              DateTime.toDate(state.tracked.lastCollectedAt),
              { dateStyle: "medium", timeStyle: "short" }
            ),
          });
    }

    return state._tag === "toCome" || state._tag === "noneYet"
      ? t("post.notRead")
      : null;
  })();

  // The row's one line of words, if it has one.
  const note = (() => {
    if (state._tag === "read") {
      return state.ended === undefined ? null : endedText(state.ended);
    }

    if (state._tag === "ended") {
      return endedText(state.reason);
    }

    if (state._tag === "story") {
      return tFormats("storiesExpire");
    }

    if (state._tag === "uncounted") {
      return t("post.uncounted", {
        name: tPosts("platform", { platform: state.platform }),
        platform: state.platform,
      });
    }

    return t(`post.${state._tag}`);
  })();

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{name}</h3>
        {aside === null ? null : (
          <span className="text-muted-foreground text-sm">{aside}</span>
        )}
      </div>
      {state._tag === "read" && state.tracked.latest !== null ? (
        <MetricList counts={state.tracked.latest} />
      ) : null}
      {state._tag === "read" && state.tracked.snapshots.length > 1 ? (
        <ReadingsChart channel={name} snapshots={state.tracked.snapshots} />
      ) : null}
      {note === null ? null : (
        <p className="text-muted-foreground text-sm">{note}</p>
      )}
    </li>
  );
};

/**
 * What each channel the post went out on counted: its latest counts,
 * when they were read and how they went over time; or why there are none,
 * and whether some are to come.
 */
export const PostMetricsView = ({
  analytics,
  channelName,
  channels,
  counted,
  now,
  targets,
}: PostMetricsViewProps) => {
  const rows = countsRowsOf({ analytics, channels, counted, now, targets });

  return rows.length === 0 ? null : (
    <ul className="flex flex-col gap-6">
      {rows.map((row) => (
        <CountsRowView key={row.targetId} channelName={channelName} row={row} />
      ))}
    </ul>
  );
};

const isForbidden = Schema.is(Forbidden);

// One placeholder a channel, shaped as the row it stands in for.
const CountsSkeleton = ({
  channels,
  label,
  now,
  targets,
}: {
  readonly channels: readonly SocialChannel[];
  readonly label: string;
  readonly now: DateTime.Utc;
  readonly targets: readonly PostTarget[];
}) => (
  <div aria-busy="true" className="flex flex-col gap-6">
    <span className="sr-only">{label}</span>
    {targets.flatMap((target) =>
      target.status === "published"
        ? [
            <div key={target.id} className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-64" />
              {likelyCharted(
                target,
                channels.find(({ id }) => id === target.channelId),
                now
              ) ? (
                <Skeleton className="h-64 w-full" />
              ) : null}
            </div>,
          ]
        : []
    )}
  </div>
);

interface PostMetricsProps {
  readonly channelName: ChannelNamer;
  readonly channels: readonly SocialChannel[];
  readonly post: Post;
  readonly workspaceId: string;
}

// What changes the counts' answer, written as one string: a channel going out, sent again or
// removed from its platform.
const targetsStateOf = (post: Post) =>
  post.targets
    .map(
      ({ id, removedAt, round, status }) =>
        `${id}:${status}:${String(round)}:${removedAt === null ? "" : DateTime.formatIso(removedAt)}`
    )
    .join(",");

/**
 * The post's analytics, on its page, once it went live on a channel. It
 * renders in the browser, in the reader's time zone, and reads the counts
 * again whenever the post's channels change.
 */
export const PostMetrics = ({
  channelName,
  channels,
  post,
  workspaceId,
}: PostMetricsProps) => {
  const t = useTranslations("Analytics");
  const query = postAnalytics(workspaceId, post.id);
  const result = useAtomValue(query);
  const retry = useAtomRefresh(query);
  const now = DateTime.nowUnsafe();

  // Which platforms this server counts: its capabilities say, X included
  // only where the operator turned its reads on.
  const capabilities = useAtomValue(platformCapabilities(workspaceId));

  const targetsState = targetsStateOf(post);
  const shown = useRef(targetsState);

  useEffect(() => {
    if (shown.current !== targetsState) {
      shown.current = targetsState;
      retry();
    }
  }, [retry, targetsState]);

  const body = (() => {
    if (AsyncResult.isFailure(result)) {
      const forbidden = Cause.findErrorOption(result.cause).pipe(
        Option.exists(isForbidden)
      );

      return forbidden ? (
        <p className="text-sm" role="alert">
          {t("post.forbidden")}
        </p>
      ) : (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-sm">{t("post.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            {t("page.retry")}
          </Button>
        </div>
      );
    }

    // Wait for the capabilities too, so the page never names a platform
    // as counted and then takes it back. When they cannot be read, the
    // page promises no count.
    if (!AsyncResult.isSuccess(result) || AsyncResult.isInitial(capabilities)) {
      return (
        <CountsSkeleton
          channels={channels}
          label={t("post.loading")}
          now={now}
          targets={post.targets}
        />
      );
    }

    return (
      <InTimeZone timeZone={browserTimeZone()}>
        <PostMetricsView
          analytics={result.value}
          channelName={channelName}
          channels={channels}
          counted={
            AsyncResult.isSuccess(capabilities)
              ? countedOn(capabilities.value)
              : undefined
          }
          now={now}
          targets={post.targets}
        />
      </InTimeZone>
    );
  })();

  return (
    <section
      aria-labelledby="post-metrics-title"
      className="flex flex-col gap-3"
    >
      <h2 id="post-metrics-title" className="text-sm font-medium">
        {t("post.title")}
      </h2>
      {body}
    </section>
  );
};
