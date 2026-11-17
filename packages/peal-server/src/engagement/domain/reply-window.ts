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
 * and Instagram, which a person's answer with the Human Agent tag extends
 * (`humanAgentWindow`).
 */
export const metaMessagingWindow = Duration.hours(24);

/**
 * How long before Meta's own instant Peal shuts the window: a message Peal
 * lets through is never refused by Meta for a clock a minute apart.
 */
export const metaWindowSkew = Duration.minutes(1);

/**
 * Meta's window for a person's answer: "HUMAN_AGENT – For a message sent
 * to a customer from a human agent in response to the customer's
 * inquiries. The message can be sent within 7 days after a customer's
 * last message." (developers.facebook.com/docs/graph-api/reference/page/
 * messages, read 2026-11-16), "Only HUMAN_AGENT is available for
 * Instagram Messaging" (the same page). The Human Agent feature "allows
 * your app to have a human agent respond to user messages using the
 * human_agent tag within 7 days of a user's message", and "requires
 * successful completion of the App Review process" and business
 * verification (developers.facebook.com/documentation/development/
 * features-reference/human-agent, read 2026-11-16).
 */
export const humanAgentWindow = Duration.days(7);

// Open until `length` less the skew, after the person last wrote.
const openFor =
  (length: Duration.Duration) =>
  (
    lastIncomingAt: Option.Option<DateTime.Utc>,
    now: DateTime.Utc
  ): ReplyWindow =>
    Option.match(lastIncomingAt, {
      onNone: () => shut,
      onSome: (at) => {
        const closesAt = DateTime.addDuration(
          at,
          Duration.subtract(length, metaWindowSkew)
        );

        return {
          closesAt: Option.some(closesAt),
          open: DateTime.isLessThan(now, closesAt),
        };
      },
    });

const metaWindow = openFor(metaMessagingWindow);

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

/**
 * The longer window a member answering in person has on Messenger and
 * Instagram, with Meta's Human Agent tag: until 7 days after the person's
 * last message (`humanAgentWindow`), ended a minute early as the 24 hours
 * are. None on a platform without one (Mastodon, Bluesky, whose window
 * never closes). Whether a message may use it is the caller's to decide:
 * a member in their own session, on a server whose operator holds Meta's
 * review of the feature, never a rule, a tool or a key.
 */
export const personWindowOf = (
  platform: InboxMessagePlatform,
  lastIncomingAt: Option.Option<DateTime.Utc>,
  now: DateTime.Utc
): Option.Option<ReplyWindow> =>
  platform === "facebook" || platform === "instagram"
    ? Option.some(openFor(humanAgentWindow)(lastIncomingAt, now))
    : Option.none();

/**
 * The window a message is held to: the platform's own, and, for a member
 * answering in person (`byPerson`) where the operator's app holds Meta's
 * Human Agent feature (`humanAgent`), Meta's longer one once the
 * platform's has shut.
 */
export const answerWindowOf = (
  platform: InboxMessagePlatform,
  lastIncomingAt: Option.Option<DateTime.Utc>,
  now: DateTime.Utc,
  {
    byPerson,
    humanAgent,
  }: { readonly byPerson: boolean; readonly humanAgent: boolean }
): ReplyWindow => {
  const standard = replyWindowOf(platform, lastIncomingAt, now);

  return standard.open || !byPerson || !humanAgent
    ? standard
    : Option.getOrElse(
        personWindowOf(platform, lastIncomingAt, now),
        () => standard
      );
};
