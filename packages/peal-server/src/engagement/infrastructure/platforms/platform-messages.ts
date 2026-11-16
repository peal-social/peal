import { DateTime, Duration, Effect, Layer, Option } from "effect";
import type { Redacted } from "effect";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { ChannelUnreadable } from "#engagement/application/channel-unreadable.ts";
import { MessagesUngranted } from "#engagement/application/messages-ungranted.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageSender } from "#engagement/application/ports/message-sender.ts";
import type { MessageSendRequest } from "#engagement/application/ports/message-sender.ts";
import { MessageSource } from "#engagement/application/ports/message-source.ts";
import type {
  MessagesFollowOutcome,
  MessagesFollowRequest,
  MessagesRequest,
} from "#engagement/application/ports/message-source.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { dueForCheck } from "#engagement/domain/conversation.ts";
import type { DirectMessage } from "#engagement/domain/direct-message.ts";
import {
  messageAbilitiesOf,
  namesMessageScopes,
  readsMessagesOn,
} from "#engagement/domain/message-abilities.ts";
import type {
  MessageFailure,
  MessageSendOutcome,
} from "#engagement/domain/outgoing-message.ts";
import {
  databaseDown,
  needsReconnect,
  unusable,
} from "#engagement/infrastructure/platforms/channel-refusals.ts";
import type { PlatformHttp } from "#engagement/infrastructure/platforms/engagement-platform.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import type { InboxMessagePlatform } from "#shared/domain/inbox-message-platform.ts";
import type { MetaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";

import { blueskyMessages } from "./bluesky/bluesky-messages.ts";
import { mastodonMessages } from "./mastodon/mastodon-messages.ts";
import { carriedBy } from "./message-platform.ts";
import type {
  FollowedAccount,
  Followers,
  MessagePlatform,
} from "./message-platform.ts";
import { metaMessages } from "./meta/meta-messages.ts";

/** How far apart the platform's clock and Peal's may be. */
const clockSkew = Duration.minutes(1);

/**
 * The platform's ids a resumed message may not take for its own: the
 * account's messages sent before it was written (less `skew`), and those
 * another message of Peal's went out as. One of the account's sent since,
 * that nothing of Peal's claims, may be this very message, read back from
 * its echo (Meta's `message_echoes`): it stays free, and the platform's
 * look-up still asks for exactly one, with the text.
 */
export const takenIdsOf = (
  kept: readonly Pick<
    DirectMessage,
    "fromAccount" | "platformMessageId" | "sentAt"
  >[],
  others: readonly {
    readonly id: string;
    readonly platformMessageId: Option.Option<string>;
  }[],
  message: { readonly createdAt: DateTime.Utc; readonly id: string },
  skew: Duration.Duration = clockSkew
): readonly string[] => {
  const since = DateTime.subtractDuration(message.createdAt, skew);

  const claimed = new Set(
    others.flatMap((other) =>
      other.id === message.id ? [] : Option.toArray(other.platformMessageId)
    )
  );

  return [
    ...new Set([
      ...kept.flatMap(({ fromAccount, platformMessageId, sentAt }) =>
        fromAccount &&
        (DateTime.isLessThan(sentAt, since) || claimed.has(platformMessageId))
          ? [platformMessageId]
          : []
      ),
      ...claimed,
    ]),
  ];
};

// What the gate answers for a message it did not call the platform for
// and cannot tell the fate of: one no longer on its way, whose job then
// finds it settled, or a resumed one.
const notClaimed: MessageSendOutcome = {
  _tag: "unconfirmed",
  reason: "interrupted",
};

const failedWith = (reason: MessageFailure): MessageSendOutcome => ({
  _tag: "failed",
  reason,
});

// Why nothing was sent, when the channels context gave no token.
const accessFailureOf = (failure: {
  readonly _tag: string;
}): MessageFailure => {
  if (failure._tag === "ChannelUnusable") {
    return "channelUnavailable";
  }

  return failure._tag === "TokenExpired"
    ? "reconnectNeeded"
    : "platformUnavailable";
};

/**
 * The direct messages of Mastodon, Bluesky, Facebook Pages and Instagram,
 * as the channel's gate runs them: `MessageSource` reads a channel's conversations, `MessageSender`
 * sends what the engagement tables hold, found by id, so no text travels
 * with a call. Only where the inbox reads the platform's messages
 * (`readsMessagesOn`) and the channel granted what it takes
 * (`messageAbilitiesOf`): otherwise nothing is called. Needs
 * ChannelAccess, the MessageStore, MessageChannelsOfAccount (whether
 * another channel follows an account's events), Mac and
 * CurrentInboxMessages.
 */
export const platformMessagesWith = (settings: {
  readonly http: PlatformHttp;
  /** The client conversations are read with, whose answers end rather than fail when long. */
  readonly reader: PlatformHttp;
  readonly mastodonScheme: "http:" | "https:";
  /**
   * Meta's main app's secret, whose proof Facebook Login's calls carry;
   * none on a server without that app.
   */
  readonly metaAppSecret: Option.Option<Redacted.Redacted>;
  readonly metaHosts: MetaHosts;
}) =>
  Layer.unwrap(
    Effect.gen(function* PlatformMessages() {
      const access = yield* ChannelAccess;
      const store = yield* MessageStore;
      const messages = yield* CurrentInboxMessages;
      const accounts = yield* MessageChannelsOfAccount;

      const meta = yield* metaMessages({
        appSecret: settings.metaAppSecret,
        hosts: settings.metaHosts,
        http: settings.http,
      });

      const platforms: Readonly<Record<InboxMessagePlatform, MessagePlatform>> =
        {
          bluesky: yield* blueskyMessages({ http: settings.http }),
          facebook: meta,
          instagram: meta,
          mastodon: yield* mastodonMessages({
            http: settings.http,
            reader: settings.reader,
            scheme: settings.mastodonScheme,
          }),
        };

      const read = Effect.fn("MessageSource.read")(function* read(
        request: MessagesRequest
      ) {
        const account = yield* access.account(request.channelId).pipe(
          Effect.catchTags({
            ChannelUnusable: unusable,
            DatabaseError: databaseDown,
            TokenExpired: needsReconnect,
          })
        );

        if (!readsMessagesOn(account.platform, messages)) {
          return yield* new ChannelUnreadable({ reason: "unsupported" });
        }

        // A channel whose account does not grant what reading takes is
        // never called: its messages were turned on with it, so it was
        // signed in again without it, and they are turned off. One whose
        // scopes still name it in another form is paused instead: what a
        // refresh answers is not a reason to delete.
        if (
          messageAbilitiesOf(
            account.platform,
            account.scopes,
            messages,
            account.connection
          ).read !== "available"
        ) {
          return yield* namesMessageScopes(account.platform, account.scopes)
            ? new ChannelUnreadable({ reason: "paused" })
            : new MessagesUngranted();
        }

        const known = yield* store
          .conversationsOf(request.channelId)
          .pipe(Effect.catchTag("DatabaseError", databaseDown));

        const now = yield* DateTime.now;

        // A conversation not read back whole for a day is read back
        // whatever its revision says, so a deletion there is seen.
        const byPlatformId = new Map(
          known.map((conversation) => [
            conversation.platformConversationId,
            conversation.id,
          ])
        );

        // What Peal keeps of a conversation, read when the adapter asks;
        // unknown when the database does not answer, which makes the read
        // not whole, so nothing is deleted.
        const keptOf = (platformConversationId: string) => {
          const id = byPlatformId.get(platformConversationId);

          return id === undefined
            ? Effect.succeed(Option.some<readonly string[]>([]))
            : store.messagesOf(id).pipe(
                Effect.map((kept) =>
                  Option.some<readonly string[]>(
                    kept.map(({ platformMessageId }) => platformMessageId)
                  )
                ),
                Effect.orElseSucceed(() => Option.none<readonly string[]>())
              );
        };

        return yield* platforms[account.platform].read(account, {
          keptOf,
          keptSince: request.keptSince,
          known: new Map(
            known.flatMap((conversation) =>
              dueForCheck(conversation, now)
                ? []
                : [
                    [
                      conversation.platformConversationId,
                      conversation.revision,
                    ] as const,
                  ]
            )
          ),
        });
      });

      // The other channels whose events come through the subscription
      // of one of the accounts, by its app.
      const othersOf = (
        channelId: ChannelId,
        followed: readonly FollowedAccount[]
      ) =>
        Effect.all(
          followed.map((carried) =>
            accounts.channelsOf(carried.platform, carried.accountId).pipe(
              Effect.map((found) =>
                found.filter(
                  (channel) =>
                    channel.channelId !== channelId &&
                    carriedBy(carried, {
                      connection: channel.connection,
                      platform: carried.platform,
                    })
                )
              )
            )
          )
        ).pipe(Effect.map((found) => found.flat()));

      // Whether a channel of Peal's other than `channelId` reads the
      // messages of one of the accounts: it has a box. Unknown when the
      // database does not answer, which keeps the subscription. Once it
      // is stopped, the others follow again at their next read.
      const followersOf = (channelId: ChannelId): Followers => ({
        elsewhere: (followed) =>
          othersOf(channelId, followed).pipe(
            Effect.flatMap((others) =>
              Effect.all(others.map((other) => store.box(other.channelId)))
            ),
            Effect.map((boxes) => boxes.some(Option.isSome)),
            Effect.orElseSucceed(() => true)
          ),
        stopped: (followed) =>
          othersOf(channelId, followed).pipe(
            Effect.flatMap((others) =>
              store.refollow(others.map((other) => other.channelId))
            ),
            Effect.catch(() =>
              Effect.logWarning(
                "Could not mark channels to follow their events again"
              ).pipe(Effect.annotateLogs({ channelId }))
            )
          ),
      });

      // Asks the channel's platform to tell the server of its account's
      // messages, or to stop: only where the inbox reads them, and only on
      // a platform that tells; elsewhere nothing is called.
      const subscription = (mode: "follow" | "unfollow") =>
        Effect.fn(`MessageSource.${mode}`)(function* subscribing(
          request: MessagesFollowRequest
        ) {
          const account = yield* access.account(request.channelId).pipe(
            Effect.catchTags({
              ChannelUnusable: unusable,
              DatabaseError: databaseDown,
              TokenExpired: needsReconnect,
            })
          );

          const { platform } = account;

          if (!readsMessagesOn(platform, messages)) {
            return "unneeded" satisfies MessagesFollowOutcome;
          }

          const { follow, unfollow } = platforms[platform];

          if (mode === "follow") {
            return follow === undefined
              ? ("unneeded" satisfies MessagesFollowOutcome)
              : yield* follow(account);
          }

          return unfollow === undefined
            ? ("unneeded" satisfies MessagesFollowOutcome)
            : yield* unfollow(account, followersOf(account.channelId));
        });

      // The channel's account, if it may send there, or why nothing can be
      // sent: each before any request to the platform.
      const reach = (request: MessageSendRequest) =>
        access.account(request.channelId).pipe(
          Effect.map(
            (
              account
            ): Option.Option<readonly [ChannelAccount, InboxMessagePlatform]> =>
              readsMessagesOn(account.platform, messages) &&
              messageAbilitiesOf(
                account.platform,
                account.scopes,
                messages,
                account.connection
              ).send === "available"
                ? Option.some([account, account.platform] as const)
                : Option.none()
          ),
          Effect.mapError(accessFailureOf)
        );

      const sending = (
        request: MessageSendRequest,
        mode: "resume" | "send"
      ): Effect.Effect<MessageSendOutcome> =>
        Effect.gen(function* send() {
          // A resumed message may be out since its first run: whatever
          // keeps this run from asking the platform proves nothing.
          const stopped = (reason: MessageFailure): MessageSendOutcome =>
            mode === "send" ? failedWith(reason) : notClaimed;

          const message = yield* store.outgoing(request.messageId);

          const summary = yield* Option.match(message, {
            onNone: () => Effect.succeed(Option.none()),
            onSome: ({ conversationId }) => store.conversation(conversationId),
          });

          if (Option.isNone(message) || Option.isNone(summary)) {
            return stopped("conversationGone");
          }

          const reached = yield* reach(request).pipe(Effect.result);

          if (reached._tag === "Failure") {
            return stopped(reached.failure);
          }

          if (Option.isNone(reached.success)) {
            return stopped("channelUnavailable");
          }

          const [account, platform] = reached.success.value;
          const { conversation } = summary.value;
          const kept = yield* store.messagesOf(conversation.id);
          const others = yield* store.outgoingOf(conversation.id);

          // Claimed just before the call, and only while the message is on
          // its way: one handed over meanwhile is not sent.
          if (
            !(yield* store.claimCall(request.messageId, yield* DateTime.now))
          ) {
            return notClaimed;
          }

          return yield* platforms[platform][mode](account, {
            createdAt: message.value.createdAt,
            latestPlatformId: Option.fromUndefinedOr(
              kept.at(-1)?.platformMessageId
            ),
            messageId: message.value.id,
            participants: conversation.participants,
            platformConversationId: conversation.platformConversationId,
            request: conversation.request,
            takenIds: takenIdsOf(
              kept,
              others.map((other) => ({
                id: other.id,
                platformMessageId:
                  other.status._tag === "sent"
                    ? other.status.platformMessageId
                    : Option.none(),
              })),
              message.value
            ),
            text: message.value.text,
          });
        }).pipe(
          // Logged by its ids alone, never the failure's cause.
          Effect.catchTag("DatabaseError", () =>
            Effect.logWarning("Could not read a direct message to send").pipe(
              Effect.annotateLogs({
                channelId: request.channelId,
                messageId: request.messageId,
              }),
              Effect.as(
                mode === "send" ? failedWith("platformUnavailable") : notClaimed
              )
            )
          )
        );

      return Layer.mergeAll(
        Layer.succeed(
          MessageSource,
          MessageSource.of({
            follow: subscription("follow"),
            read,
            unfollow: subscription("unfollow"),
          })
        ),
        Layer.succeed(
          MessageSender,
          MessageSender.of({
            resume: (request) => sending(request, "resume"),
            send: (request) => sending(request, "send"),
          })
        )
      );
    })
  );
