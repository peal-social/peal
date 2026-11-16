import { DateTime, Duration, Option } from "effect";

import type { InboxMessagePlatform } from "#shared/domain/inbox-message-platform.ts";

/**
 * Whether the account may still answer a conversation, and until when:
 * `closesAt` none while no rule closes it.
 */
export interface ReplyWindow {
  readonly closesAt: Option.Option<DateTime.Utc>;
  readonly open: boolean;
}

const alwaysOpen: ReplyWindow = { closesAt: Option.none(), open: true };

const shut: ReplyWindow = { closesAt: Option.none(), open: false };

/**
 * Meta's standard messaging window: "For most user actions, it lasts 24
 * hours" after the person's last message (developers.facebook.com/
 * documentation/business-messaging/messenger-platform/policy, read
 * 2026-11-16); the Send API refuses past it (`10`/`2018278`, `10`/`2534022`,
 * its error codes' page, read the same day). Only one rule for Messenger
 * and Instagram, which "Only HUMAN_AGENT" extends, never from Peal yet.
 */
export const metaMessagingWindow = Duration.hours(24);

/**
 * How long before Meta's own instant Peal shuts the window: a message Peal
 * lets through is never refused by Meta for a clock a minute apart.
 */
export const metaWindowSkew = Duration.minutes(1);

// Open until Meta's window less the skew, after the person last wrote.
const metaWindow = (
  lastIncomingAt: Option.Option<DateTime.Utc>,
  now: DateTime.Utc
): ReplyWindow =>
  Option.match(lastIncomingAt, {
    onNone: () => shut,
    onSome: (at) => {
      const closesAt = DateTime.addDuration(
        at,
        Duration.subtract(metaMessagingWindow, metaWindowSkew)
      );

      return {
        closesAt: Option.some(closesAt),
        open: DateTime.isLessThan(now, closesAt),
      };
    },
  });

// Each platform's rule, from when the person last wrote, at `now`.
const windows: Readonly<
  Record<
    InboxMessagePlatform,
    (
      lastIncomingAt: Option.Option<DateTime.Utc>,
      now: DateTime.Utc
    ) => ReplyWindow
  >
> = {
  // Neither sets a window: a conversation stays open.
  bluesky: () => alwaysOpen,
  facebook: metaWindow,
  instagram: metaWindow,
  mastodon: () => alwaysOpen,
};

/**
 * The window in which a platform lets the account answer someone who
 * wrote to it, from when they last wrote (`lastIncomingAt`), at `now`.
 * Nobody else wrote yet: the window is shut, as Peal never makes a first
 * contact. Mastodon and Bluesky set no limit past that; Messenger and
 * Instagram take an answer until 24 hours after the person's last message
 * (`metaMessagingWindow`), which Peal ends a minute early
 * (`metaWindowSkew`), with `closesAt` that instant.
 */
export const replyWindowOf = (
  platform: InboxMessagePlatform,
  lastIncomingAt: Option.Option<DateTime.Utc>,
  now: DateTime.Utc
): ReplyWindow =>
  Option.isNone(lastIncomingAt) ? shut : windows[platform](lastIncomingAt, now);
