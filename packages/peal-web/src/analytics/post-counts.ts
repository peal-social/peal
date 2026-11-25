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
 * How long a post that went live waits for its first read. The server
 * reads a post first on the run after it went live (`firstCollection`,
 * peal-server's src/analytics/domain/collection-schedule.ts), and runs
 * every hour (`CollectMetricsCron`, src/analytics/infrastructure/crons.ts):
 * two hours leaves room for a run that came late.
 */
export const firstReadWithin = Duration.hours(2);

/**
 * Why analytics no longer reads a post on a channel, as far as the page
 * can tell: `window` once it is older than `postCountsWindow`, `removed`
 * when Peal deleted it from the platform, `disconnected` when its channel
 * left the workspace, `other` otherwise (the platform gives Peal nothing).
 */
export type EndReason = "window" | "removed" | "disconnected" | "other";

/** What a channel's row says. */
export type CountsState =
  // Counts were read; `ended` says why they are read no more, if not.
  | {
      readonly _tag: "read";
      readonly ended: EndReason | undefined;
      readonly tracked: TargetMetrics;
    }
  // The post went live a moment ago: its first read is coming.
  | { readonly _tag: "toCome" }
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
  Duration.isLessThan(DateTime.distance(publishedAt, now), firstReadWithin);

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

  if (tracked.latest !== null) {
    return { _tag: "read", ended, tracked };
  }

  if (ended !== undefined) {
    return { _tag: "ended", reason: ended };
  }

  return isRecent(tracked.publishedAt, now)
    ? { _tag: "toCome" }
    : { _tag: "noneYet" };
};

const untrackedState = (
  target: PostTarget,
  channel: SocialChannel | undefined,
  counted: readonly Platform[] | undefined,
  now: DateTime.Utc
): CountsState => {
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

  return isRecent(target.publishedAt, now)
    ? { _tag: "toCome" }
    : { _tag: "none" };
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
