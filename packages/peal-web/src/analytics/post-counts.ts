import { DateTime, Duration } from "effect";
import { countedPlatforms, postCountsReadForDays } from "peal-contract";
import type {
  Platform,
  PostAnalytics,
  PostTarget,
  SocialChannel,
  TargetMetrics,
} from "peal-contract";
import { postFormatOf } from "peal-contract/post-text";

// What a post's page says of its counts on each channel it went out on,
// from what the page already holds: the post, the workspace's channels,
// what analytics answered, and the platforms this server reads counts on.

/** How long after it went live Peal reads a post's counts. */
export const postCountsWindow = Duration.days(postCountsReadForDays);

/**
 * How long after it went live analytics starts following a post: the
 * hourly collection (`CollectMetricsCron`, peal-server's
 * src/analytics/infrastructure/crons.ts) picks up the posts that went live
 * since its last run, so two hours leaves room for a run that came late.
 * A post it does not follow by then, it never will.
 */
export const followedWithin = Duration.hours(2);

/**
 * How often the server reads a post near the end of its window: daily
 * from its third day (`nextCollection`, peal-server's
 * src/analytics/domain/collection-schedule.ts). A post last read longer
 * than that before its window ended stopped for another reason.
 */
const lateRead = Duration.days(1);

/** Why a channel present in the workspace is not read for now. */
export type Pause = "disabled" | "refreshNeeded";

/**
 * Why analytics no longer reads a post on a channel, as far as the page
 * can tell: `window` once it is older than `postCountsWindow`, `removed`
 * when Peal deleted it from the platform, `disconnected` when its channel
 * left the workspace, `other` otherwise (the platform gives Peal nothing).
 */
export type EndReason = "window" | "removed" | "disconnected" | "other";

/** What a channel's row says. */
export type CountsState =
  // Counts were read; `ended` says why they are read no more, if not, and
  // `paused` why the channel is not read for now.
  | {
      readonly _tag: "read";
      readonly ended: EndReason | undefined;
      readonly paused: Pause | undefined;
      readonly tracked: TargetMetrics;
    }
  // Analytics follows the post, or may still: its counts show once read.
  | { readonly _tag: "toCome" }
  // The channel is turned off or needs reconnecting: nothing is read.
  | { readonly _tag: "paused"; readonly status: Pause }
  // Nothing read yet, and nothing promised.
  | { readonly _tag: "noneYet" }
  // Analytics stopped before reading anything.
  | { readonly _tag: "ended"; readonly reason: EndReason }
  // The platform gives Peal no counts for this account or post.
  | { readonly _tag: "uncounted"; readonly platform: Platform }
  // A story: it leaves after a day, and Peal reads nothing of it.
  | { readonly _tag: "story" }
  // Analytics never followed it, and will not now.
  | { readonly _tag: "none" };

export interface CountsRow {
  /** The channel, while the workspace has it. */
  readonly channel: SocialChannel | undefined;
  readonly channelId: string;
  readonly state: CountsState;
  readonly targetId: string;
}

interface CountsInput {
  readonly analytics: PostAnalytics;
  readonly channels: readonly SocialChannel[];
  /**
   * The platforms this server reads counts on, from its capabilities;
   * undefined when they could not be read.
   */
  readonly counted: readonly Platform[] | undefined;
  readonly now: DateTime.Utc;
  /** The post's targets, in its order. */
  readonly targets: readonly PostTarget[];
}

const readers: readonly Platform[] = countedPlatforms;

// On LinkedIn, Peal reads the counts of company pages only.
const hasReaderFor = ({ connection, platform }: SocialChannel) =>
  readers.includes(platform) &&
  (platform !== "linkedin" || connection === "linkedinPage");

const isRecent = (publishedAt: DateTime.Utc | null, now: DateTime.Utc) =>
  publishedAt !== null &&
  Duration.isLessThan(DateTime.distance(publishedAt, now), followedWithin);

const pauseOf = (channel: SocialChannel | undefined): Pause | undefined =>
  channel === undefined || channel.status._tag === "active"
    ? undefined
    : channel.status._tag;

const endReasonOf = (
  tracked: TargetMetrics,
  target: PostTarget,
  channel: SocialChannel | undefined,
  now: DateTime.Utc
): EndReason => {
  const windowEnd = DateTime.addDuration(tracked.publishedAt, postCountsWindow);

  if (
    target.removedAt !== null &&
    DateTime.isLessThan(target.removedAt, windowEnd)
  ) {
    return "removed";
  }

  // A channel that left before the window's last reads ended them,
  // however long ago.
  const stoppedEarly =
    tracked.lastCollectedAt === null ||
    DateTime.isLessThan(
      tracked.lastCollectedAt,
      DateTime.subtractDuration(windowEnd, lateRead)
    );

  if (channel === undefined && stoppedEarly) {
    return "disconnected";
  }

  if (DateTime.isGreaterThanOrEqualTo(now, windowEnd)) {
    return "window";
  }

  return channel === undefined ? "disconnected" : "other";
};

const trackedState = (
  tracked: TargetMetrics,
  target: PostTarget,
  channel: SocialChannel | undefined,
  now: DateTime.Utc
): CountsState => {
  const ended = tracked.collecting
    ? undefined
    : endReasonOf(tracked, target, channel, now);

  const paused = ended === undefined ? pauseOf(channel) : undefined;

  if (tracked.latest !== null) {
    return { _tag: "read", ended, paused, tracked };
  }

  if (ended !== undefined) {
    return { _tag: "ended", reason: ended };
  }

  return paused === undefined
    ? { _tag: "toCome" }
    : { _tag: "paused", status: paused };
};

const untrackedState = (
  target: PostTarget,
  channel: SocialChannel | undefined,
  counted: readonly Platform[] | undefined,
  now: DateTime.Utc
): CountsState => {
  // Analytics never follows a post removed from its platform.
  if (target.removedAt !== null) {
    return { _tag: "ended", reason: "removed" };
  }

  if (channel === undefined) {
    return { _tag: "none" };
  }

  const { platform } = channel;

  if (
    target.options !== null &&
    postFormatOf(platform, target.options) === "story"
  ) {
    return { _tag: "story" };
  }

  if (!hasReaderFor(channel)) {
    return { _tag: "uncounted", platform };
  }

  if (counted === undefined) {
    return { _tag: "noneYet" };
  }

  if (!counted.includes(platform)) {
    return { _tag: "uncounted", platform };
  }

  if (!isRecent(target.publishedAt, now)) {
    return { _tag: "none" };
  }

  const paused = pauseOf(channel);

  return paused === undefined
    ? { _tag: "toCome" }
    : { _tag: "paused", status: paused };
};

/**
 * A row for each channel the post went live on, or that analytics follows,
 * in the post's order.
 */
export const countsRowsOf = ({
  analytics,
  channels,
  counted,
  now,
  targets,
}: CountsInput): readonly CountsRow[] =>
  targets.flatMap((target) => {
    const tracked = analytics.targets.find(
      ({ targetId }) => targetId === target.id
    );

    if (tracked === undefined && target.status !== "published") {
      return [];
    }

    const channel = channels.find(({ id }) => id === target.channelId);

    return [
      {
        channel,
        channelId: target.channelId,
        state:
          tracked === undefined
            ? untrackedState(target, channel, counted, now)
            : trackedState(tracked, target, channel, now),
        targetId: target.id,
      },
    ];
  });

/**
 * What, of a post's channels, changes what analytics answers for it: each
 * channel's status, its round and whether it was removed from its
 * platform, as one string.
 */
export const channelsRevisionOf = (targets: readonly PostTarget[]): string =>
  targets
    .map(
      ({ id, removedAt, round, status }) =>
        `${id}:${status}:${String(round)}:${removedAt === null ? "" : DateTime.formatIso(removedAt)}`
    )
    .join(",");

/**
 * Whether a target that went live is likely to show a chart once its
 * counts load: for the skeleton that stands in for its row.
 */
export const likelyCharted = (
  target: PostTarget,
  channel: SocialChannel | undefined,
  now: DateTime.Utc
): boolean =>
  channel !== undefined &&
  hasReaderFor(channel) &&
  target.publishedAt !== null &&
  !isRecent(target.publishedAt, now);
