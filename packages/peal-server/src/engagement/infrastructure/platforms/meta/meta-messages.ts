import {
  DateTime,
  Duration,
  Effect,
  Metric,
  Option,
  Ref,
  Schema,
} from "effect";
import type { Redacted } from "effect";
import { HttpClientResponse } from "effect/http";
import type { HttpClientResponse as Response } from "effect/http";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { ChannelUnreadable } from "#engagement/application/channel-unreadable.ts";
import type {
  MessagesBatch,
  MessagesFollowOutcome,
  MessagesReadFailure,
} from "#engagement/application/ports/message-source.ts";
import type {
  ConversationReading,
  Participant,
} from "#engagement/domain/conversation.ts";
import type { MessageReading } from "#engagement/domain/direct-message.ts";
import type {
  MessageFailure,
  MessageSendOutcome,
} from "#engagement/domain/outgoing-message.ts";
import {
  databaseDown,
  messageRefusedWith,
  needsReconnect,
  unusable,
} from "#engagement/infrastructure/platforms/channel-refusals.ts";
import type {
  FollowedAccount,
  FollowedElsewhere,
  MessagePlatform,
  MessagesToRead,
  OutgoingDirect,
} from "#engagement/infrastructure/platforms/message-platform.ts";
import { messagesListingTruncated } from "#engagement/infrastructure/platforms/messages-listing.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import { graphRefusalOf } from "#shared/infrastructure/platforms/graph-refusal.ts";

import {
  defaultDeadline,
  instantOf,
  isSuccess,
  nextCursor,
  nodePath,
  pageAfter,
  PagingSchema,
  pastUsageCeiling,
  requestsWith,
} from "./meta-comments.ts";
import type { MetaEngagementOptions } from "./meta-comments.ts";

// The direct messages of a Facebook Page (Messenger) and of an Instagram
// professional account, through either of Instagram's ways in, from
// Meta's pages (read 2026-11-16):
//
// - Conversations API (developers.facebook.com/documentation/
//   business-messaging/messenger-platform/conversations, and for
//   Instagram Login …/instagram-platform/instagram-api-with-instagram-login/
//   conversations-api): `GET /me/conversations?platform=messenger|instagram`
//   with the Page's token on graph.facebook.com, or the account's on
//   graph.instagram.com; `GET /<CONVERSATION_ID>?fields=messages`, whose
//   messages come the latest first; "you can only get details about the 20
//   most recent messages in the conversation. If you query a message that
//   is older than the last 20, you will see an error that the message has
//   been deleted." Conversations in the Requests folder "that have not
//   been active for 30 days will not be returned". The order of the
//   conversations is not stated: a read lists them to the end, or to its
//   page cap.
// - Message (developers.facebook.com/docs/graph-api/reference/message):
//   `from` (`id`; `name` on Messenger, `username` on Instagram),
//   `message` ("If no text is part of the message, this will be empty"),
//   `created_time`, `attachments` and `story` (a mention's or a reply's
//   CDN link). Peal counts files and a story as one, and keeps no address:
//   "You must not store or cache the media content on your server"
//   (…/instagram-messaging/features/story-mention).
// - Rate limiting (…/messenger-platform/overview/rate-limiting): the
//   Conversations API takes "2 calls per second per Facebook Page", and
//   per Instagram account: a read waits `pace` between two calls.
// - Send API (…/messenger-platform/send-messages, and Instagram's
//   …/instagram/features/send-message): `POST /me/messages` with
//   `recipient: { id }`, `messaging_type: RESPONSE` and `message: { text }`,
//   answering `{ recipient_id, message_id }`. No idempotency parameter
//   exists: a resume never sends.
// - Its error codes (…/messenger-platform/error-codes): outside the window
//   `10`/`2018278` and `10`/`2534022`; the person takes no message
//   `10`/`2018108`, `551`, `200`/`1545041`; a person without a role on the
//   app before its review `200`/`2018028`; Instagram's access to messages
//   off `200`/`2534041`; no such Instagram user `100`/`2534014`; the rate
//   `613`, `4`.
// - Webhooks (the Graph reference of `/{page-id}/subscribed_apps`, and
//   Instagram Login's …/webhooks): `POST /me/subscribed_apps` with
//   `subscribed_fields`, answering `{ success }`; `DELETE` stops them. The
//   reference says Instagram's fields through a Page are chosen in the
//   dashboard: the Page's subscription is what carries them.
//
// Written from those pages and never run against Meta: the trial on the
// sandbox checks what src/engagement/AGENTS.md lists as Not verified.

export interface MetaMessagesOptions extends MetaEngagementOptions {
  /** How long a read waits between two calls of one account. */
  readonly pace?: Duration.Duration;
}

/** Half a second: two calls a second, Meta's limit for one account. */
export const conversationsPace = Duration.millis(500);

// Fifty conversations a page, five pages: 250 a read, past which the read
// halts and is counted.
const listPageSize = 50;

const maxPages = 5;

/** The messages of a conversation whose details Meta gives: its latest. */
export const detailedMessages = 20;

// The files a message is counted with at most.
const maxAttachments = 10;

/** How long before a message was written its copy on Meta may say it was sent. */
const clockSkew = Duration.minutes(1);

// The fields of a conversation in a list: its id, when it last changed,
// and who is in it.
const listFields = "id,updated_time,participants";

// The fields of a conversation read back: its 20 latest messages, each
// with its sender, its text, its files' ids and its story, if any.
const messageFields = `messages.limit(${String(detailedMessages)}){id,created_time,from,message,attachments.limit(${String(maxAttachments)}){id},story}`;

// An instant as Meta writes it: ISO 8601, or seconds or milliseconds
// since the epoch (its pages' samples show `UNIX-TIMESTAMP`).
const InstantSchema = Schema.Union([Schema.String, Schema.Number]);

// A number, or a number written as text: seconds, or milliseconds.
const decodeEpoch = Schema.decodeUnknownOption(
  Schema.Union([Schema.Finite, Schema.FiniteFromString])
);

const decodeText = Schema.decodeUnknownOption(Schema.String);

// Below this, an instant is seconds, not milliseconds (before 1973 as ms).
const smallestMillis = 100_000_000_000;

const instantFrom = (
  written: typeof InstantSchema.Type
): Option.Option<DateTime.Utc> =>
  decodeEpoch(written).pipe(
    Option.flatMap((value) =>
      DateTime.make(value < smallestMillis ? value * 1000 : value)
    ),
    Option.orElse(() => decodeText(written).pipe(Option.flatMap(instantOf)))
  );

const PersonSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.optionalKey(Schema.String),
  username: Schema.optionalKey(Schema.String),
});

type Person = typeof PersonSchema.Type;

const ConversationSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  participants: Schema.optionalKey(
    Schema.Struct({ data: Schema.Array(PersonSchema) })
  ),
  updated_time: Schema.optionalKey(InstantSchema),
});

type ListedConversation = typeof ConversationSchema.Type;

const listOf = HttpClientResponse.schemaBodyJson(
  Schema.Struct({
    data: Schema.Array(ConversationSchema),
    paging: PagingSchema,
  })
);

const MessageSchema = Schema.Struct({
  attachments: Schema.optionalKey(
    Schema.Struct({ data: Schema.Array(Schema.Unknown) })
  ),
  created_time: Schema.optionalKey(InstantSchema),
  from: Schema.optionalKey(PersonSchema),
  id: Schema.NonEmptyString,
  message: Schema.optionalKey(Schema.String),
  // Read only to count it: its link is never kept.
  story: Schema.optionalKey(Schema.Unknown),
});

type GraphMessage = typeof MessageSchema.Type;

const threadOf = HttpClientResponse.schemaBodyJson(
  Schema.Struct({
    id: Schema.String,
    messages: Schema.optionalKey(
      Schema.Struct({
        data: Schema.Array(MessageSchema),
        paging: PagingSchema,
      })
    ),
  })
);

const SentSchema = Schema.Struct({ message_id: Schema.NonEmptyString });

const sentOf = HttpClientResponse.schemaBodyJson(SentSchema);

const SucceededSchema = Schema.Struct({ success: Schema.Boolean });

const succeededOf = HttpClientResponse.schemaBodyJson(SucceededSchema);

const NodeSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  instagram_business_account: Schema.optionalKey(
    Schema.Struct({ id: Schema.NonEmptyString })
  ),
});

const nodeOf = HttpClientResponse.schemaBodyJson(NodeSchema);

// Meta's error, by its code and subcode alone: its message may quote what
// was sent.
const ErrorSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.optionalKey(Schema.Number),
    error_subcode: Schema.optionalKey(Schema.Number),
  }),
});

const errorOf = (response: Response.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ErrorSchema)(response).pipe(
    Effect.map(({ error }) => ({
      code: error.code ?? 0,
      subcode: error.error_subcode ?? 0,
    })),
    Effect.orElseSucceed(() => ({ code: 0, subcode: 0 }))
  );

const unanswered: MessageSendOutcome = {
  _tag: "unconfirmed",
  reason: "noResponse",
};

const undecided: MessageSendOutcome = {
  _tag: "unconfirmed",
  reason: "interrupted",
};

const failed = (reason: MessageFailure): MessageSendOutcome => ({
  _tag: "failed",
  reason,
});

// Why Meta refused a message, by its code and subcode; none when it gives
// no reason Peal knows, which the status decides.
const sendRefusal = (
  code: number,
  subcode: number
): Option.Option<MessageFailure> => {
  if (code === 10 && (subcode === 2_018_278 || subcode === 2_534_022)) {
    return Option.some("windowClosed");
  }

  if (code === 100 && subcode === 2_534_014) {
    return Option.some("conversationGone");
  }

  if (code === 613 || code === 4) {
    return Option.some("rateLimited");
  }

  // The person takes no message from the account (`10`/`2018108`, `551`,
  // `200`/`1545041`), or the app may not write to them yet (`2018028`,
  // before its review; `2534041`, Instagram's access to messages off).
  return code === 551 || code === 10 || (code >= 200 && code <= 299)
    ? Option.some("refused")
    : Option.none();
};

const isInstagramLogin = (account: ChannelAccount) =>
  account.platform === "instagram" &&
  Option.contains(account.connection, "instagramLogin");

// The Conversations API's name of the account's platform.
const listedPlatform = (account: ChannelAccount) =>
  account.platform === "facebook" ? "messenger" : "instagram";

const participantOf = (account: ChannelAccount, person: Person): Participant =>
  account.platform === "instagram"
    ? {
        displayName: Option.none(),
        handle:
          person.username === undefined || person.username.trim() === ""
            ? ""
            : `@${person.username}`,
        platformId: person.id,
      }
    : {
        displayName: Option.fromUndefinedOr(person.name).pipe(
          Option.filter((name) => name.trim() !== "")
        ),
        // Messenger shows a name, and no handle.
        handle: "",
        platformId: person.id,
      };

const readingOf = (
  account: ChannelAccount,
  message: GraphMessage
): Option.Option<MessageReading> =>
  Option.fromUndefinedOr(message.created_time).pipe(
    Option.flatMap(instantFrom),
    Option.map((sentAt): MessageReading => ({
      attachments:
        Math.min(message.attachments?.data.length ?? 0, maxAttachments) +
        (message.story === undefined ? 0 : 1),
      fromAccount: message.from?.id === account.accountId,
      platformMessageId: message.id,
      senderPlatformId: Option.fromUndefinedOr(message.from?.id),
      sentAt,
      text: message.message ?? "",
    }))
  );

// The person the message goes to: the conversation's other account.
const recipientOf = (message: OutgoingDirect) =>
  Option.fromUndefinedOr(message.participants[0]?.platformId);

/**
 * A Page's and an Instagram account's direct messages, for Facebook Pages
 * and Instagram alike: the way in (`ChannelAccount.connection`) decides
 * the host, the token and whether calls carry the proof (`graphRequest`).
 */
export const metaMessages = Effect.fn("MetaMessages.make")(
  function* metaMessages(options: MetaMessagesOptions) {
    const access = yield* ChannelAccess;
    const request = yield* requestsWith(options);
    const { http } = options;
    const pace = options.pace ?? conversationsPace;
    const deadlineAfter = options.deadline ?? defaultDeadline;

    // A Graph call as the account, half a second after its last one in
    // this read: its answer, or none when nothing came back.
    const pacedCalls = Effect.fnUntraced(function* pacedCalls() {
      const last = yield* Ref.make(Option.none<DateTime.Utc>());

      return (
        account: ChannelAccount,
        token: Redacted.Redacted,
        path: string,
        params: Readonly<Record<string, string>>
      ) =>
        Effect.gen(function* paced() {
          const previous = yield* Ref.get(last);
          const now = yield* DateTime.now;

          if (Option.isSome(previous)) {
            const ready = DateTime.addDuration(previous.value, pace);

            if (DateTime.isLessThan(now, ready)) {
              yield* Effect.sleep(DateTime.distance(now, ready));
            }
          }

          yield* Ref.set(last, Option.some(yield* DateTime.now));

          return yield* request(account, token, "GET", path, params).pipe(
            Effect.flatMap(http.execute),
            Effect.option
          );
        });
    });

    type Call = Effect.Success<ReturnType<typeof pacedCalls>>;

    // What a refused read means: a refused token, for ChannelAccess to
    // renew; a missing permission, which pauses the channel and deletes
    // nothing (the app not yet reviewed for the account, Instagram's
    // access to messages off, an unverified business); the rate; or Meta
    // failing.
    const readRefusal = Effect.fn("MetaMessages.readRefusal")(
      function* readRefusal(response: Response.HttpClientResponse) {
        const refusal = yield* graphRefusalOf(response);

        if (refusal._tag === "token") {
          return yield* refusal.permission
            ? new ChannelUnreadable({ reason: "paused" })
            : new TokenRejected();
        }

        if (refusal._tag === "rateLimited") {
          return yield* Option.match(refusal.retryAfter, {
            onNone: () => new RateLimited({}),
            onSome: (retryAfter) => new RateLimited({ retryAfter }),
          });
        }

        return yield* new PlatformUnavailable();
      }
    );

    // A conversation's latest messages read back: whole when it holds no
    // more than Meta details and every one came with its details.
    const readBack = Effect.fn("MetaMessages.readBack")(function* readBack(
      call: Call,
      account: ChannelAccount,
      token: Redacted.Redacted,
      listed: ListedConversation,
      lastMessageAt: DateTime.Utc,
      toRead: MessagesToRead
    ) {
      const answer = yield* call(account, token, nodePath(listed.id), {
        fields: messageFields,
      });

      if (Option.isNone(answer)) {
        return yield* new PlatformUnavailable();
      }

      if (!isSuccess(answer.value)) {
        return yield* readRefusal(answer.value);
      }

      const thread = yield* threadOf(answer.value).pipe(
        Effect.mapError(() => new PlatformUnavailable())
      );

      const data = thread.messages?.data ?? [];
      const messages: MessageReading[] = [];
      let detailedAll = true;

      for (const message of data) {
        const reading = readingOf(account, message);

        if (Option.isNone(reading)) {
          detailedAll = false;
        } else if (
          DateTime.isGreaterThanOrEqualTo(
            reading.value.sentAt,
            toRead.keptSince
          )
        ) {
          messages.push(reading.value);
        }
      }

      const reading: ConversationReading = {
        complete:
          detailedAll &&
          data.length <= detailedMessages &&
          Option.isNone(nextCursor(thread.messages?.paging)),
        deleted: [],
        lastMessageAt,
        // Kept oldest first, as a conversation is shown.
        messages: messages.toReversed(),
        participants: (listed.participants?.data ?? [])
          .filter(({ id }) => id !== account.accountId)
          .map((person) => participantOf(account, person)),
        platformConversationId: listed.id,
        request: false,
        revision: String(listed.updated_time ?? ""),
      };

      return reading;
    });

    const readAll = Effect.fn("MetaMessages.readAll")(function* readAll(
      account: ChannelAccount,
      token: Redacted.Redacted,
      toRead: MessagesToRead
    ) {
      const call = yield* pacedCalls();
      const deadline = DateTime.addDuration(yield* DateTime.now, deadlineAfter);
      const readings: ConversationReading[] = [];
      const seen: string[] = [];
      let after = Option.none<string>();

      const pastDeadline = DateTime.now.pipe(
        Effect.map((now) => DateTime.isGreaterThanOrEqualTo(now, deadline))
      );

      const halted = (): MessagesBatch => ({
        conversations: readings,
        halted: true,
        listed: seen,
        listedWhole: false,
      });

      for (let page = 0; page < maxPages; page += 1) {
        if (yield* pastDeadline) {
          return halted();
        }

        const answer = yield* call(account, token, "/me/conversations", {
          fields: listFields,
          limit: String(listPageSize),
          platform: listedPlatform(account),
          ...pageAfter(after),
        });

        if (Option.isNone(answer)) {
          return yield* new PlatformUnavailable();
        }

        if (!isSuccess(answer.value)) {
          return yield* readRefusal(answer.value);
        }

        const listed = yield* listOf(answer.value).pipe(
          Effect.mapError(() => new PlatformUnavailable())
        );

        // The Page's or account's calls are shared with its publishing.
        if (pastUsageCeiling(answer.value)) {
          seen.push(...listed.data.map(({ id }) => id));

          return halted();
        }

        for (const conversation of listed.data) {
          seen.push(conversation.id);

          const lastAt = Option.fromUndefinedOr(conversation.updated_time).pipe(
            Option.flatMap(instantFrom),
            Option.filter((at) =>
              DateTime.isGreaterThanOrEqualTo(at, toRead.keptSince)
            )
          );

          if (
            Option.isNone(lastAt) ||
            toRead.known.get(conversation.id) ===
              String(conversation.updated_time ?? "")
          ) {
            continue;
          }

          // No read-back starts past the read's time, so the channel's
          // gate is never held long.
          if (yield* pastDeadline) {
            return halted();
          }

          const read = yield* readBack(
            call,
            account,
            token,
            conversation,
            lastAt.value,
            toRead
          ).pipe(Effect.result);

          if (read._tag === "Success") {
            readings.push(read.success);
          } else if (read.failure._tag === "RateLimited") {
            return halted();
          } else if (read.failure._tag !== "PlatformUnavailable") {
            return yield* read.failure;
          }
        }

        after = nextCursor(listed.paging);

        if (Option.isNone(after)) {
          const batch: MessagesBatch = {
            conversations: readings,
            halted: false,
            listed: seen,
            listedWhole: true,
          };

          return batch;
        }
      }

      yield* Metric.update(messagesListingTruncated, 1);

      return halted();
    });

    const read = (
      account: ChannelAccount,
      toRead: MessagesToRead
    ): Effect.Effect<MessagesBatch, MessagesReadFailure> =>
      access
        .withToken(account.channelId, ({ accessToken }) =>
          readAll(account, accessToken, toRead)
        )
        .pipe(
          Effect.catchTags({
            ChannelUnusable: unusable,
            DatabaseError: databaseDown,
            TokenExpired: needsReconnect,
          })
        );

    // A call as the account, whose failures to get a token each mean
    // nothing was sent.
    const asAccount = (
      account: ChannelAccount,
      onRefused: (reason: MessageFailure) => MessageSendOutcome,
      use: (
        token: Redacted.Redacted
      ) => Effect.Effect<MessageSendOutcome, TokenRejected>
    ): Effect.Effect<MessageSendOutcome> =>
      access
        .withToken(account.channelId, ({ accessToken }) => use(accessToken))
        .pipe(Effect.catch(messageRefusedWith(onRefused)));

    const create = Effect.fn("MetaMessages.send")(function* create(
      account: ChannelAccount,
      token: Redacted.Redacted,
      message: OutgoingDirect
    ) {
      const recipient = recipientOf(message);

      if (Option.isNone(recipient)) {
        return failed("conversationGone");
      }

      const sent = yield* request(account, token, "POST", "/me/messages", {
        message: JSON.stringify({ text: message.text }),
        messaging_type: "RESPONSE",
        recipient: JSON.stringify({ id: recipient.value }),
      }).pipe(Effect.flatMap(http.execute), Effect.result);

      // The request may have reached Meta.
      if (sent._tag === "Failure") {
        return unanswered;
      }

      const response = sent.success;

      if (isSuccess(response)) {
        return yield* sentOf(response).pipe(
          Effect.map(({ message_id: id }): MessageSendOutcome => ({
            _tag: "sent",
            platformMessageId: id,
          })),
          Effect.orElseSucceed(() => unanswered)
        );
      }

      if (response.status >= 500) {
        return unanswered;
      }

      const { code, subcode } = yield* errorOf(response);

      // Refused before anything was made: a renewed token may be tried.
      if (code === 190 || code === 102) {
        return yield* new TokenRejected();
      }

      const reason = sendRefusal(code, subcode).pipe(
        Option.getOrElse(() => "refused" as const)
      );

      // Codes alone: Meta's message may quote the text.
      yield* Effect.logWarning("Meta refused a direct message").pipe(
        Effect.annotateLogs({
          channelId: account.channelId,
          code,
          messageId: message.messageId,
          subcode,
        })
      );

      return failed(reason);
    });

    // Looks for the message among the conversation's latest: exactly one
    // of the account's, written since it was, with its text, and taken by
    // no other.
    const lookUp = Effect.fn("MetaMessages.lookUp")(function* lookUp(
      account: ChannelAccount,
      token: Redacted.Redacted,
      message: OutgoingDirect
    ) {
      const answer = yield* request(
        account,
        token,
        "GET",
        nodePath(message.platformConversationId),
        { fields: messageFields }
      ).pipe(Effect.flatMap(http.execute), Effect.option);

      if (Option.isNone(answer) || !isSuccess(answer.value)) {
        return undecided;
      }

      const thread = yield* threadOf(answer.value).pipe(Effect.option);

      if (Option.isNone(thread)) {
        return undecided;
      }

      const since = DateTime.subtractDuration(message.createdAt, clockSkew);
      const taken = new Set(message.takenIds);

      const found = (thread.value.messages?.data ?? []).filter(
        (listed) =>
          listed.from?.id === account.accountId &&
          listed.message === message.text &&
          !taken.has(listed.id) &&
          Option.fromUndefinedOr(listed.created_time).pipe(
            Option.flatMap(instantFrom),
            Option.exists((at) => DateTime.isGreaterThanOrEqualTo(at, since))
          )
      );

      const [only] = found;

      return found.length === 1 && only !== undefined
        ? ({ _tag: "sent", platformMessageId: only.id } as const)
        : undecided;
    });

    // A subscription call's outcome: done on `{ "success": true }`.
    const subscribing = (
      account: ChannelAccount,
      method: "DELETE" | "POST",
      params: Readonly<Record<string, string>>
    ): Effect.Effect<MessagesFollowOutcome, MessagesReadFailure> =>
      access
        .withToken(account.channelId, (token) =>
          Effect.gen(function* subscription() {
            const answer = yield* request(
              account,
              token.accessToken,
              method,
              "/me/subscribed_apps",
              params
            ).pipe(Effect.flatMap(http.execute), Effect.option);

            if (Option.isNone(answer)) {
              return yield* new PlatformUnavailable();
            }

            if (!isSuccess(answer.value)) {
              return yield* readRefusal(answer.value);
            }

            const done = yield* succeededOf(answer.value).pipe(
              Effect.map(({ success }) => success),
              Effect.orElseSucceed(() => false)
            );

            return yield* done
              ? Effect.succeed("done" as const)
              : Effect.fail(new PlatformUnavailable());
          })
        )
        .pipe(
          Effect.catchTags({
            ChannelUnusable: unusable,
            DatabaseError: databaseDown,
            TokenExpired: needsReconnect,
          })
        );

    // The accounts whose events the account's subscription carries: the
    // Instagram Login account alone; through Facebook Login, the Page and
    // the Instagram account linked to it, read with the Page's token.
    const sharing = (
      account: ChannelAccount
    ): Effect.Effect<readonly FollowedAccount[], MessagesReadFailure> => {
      if (isInstagramLogin(account)) {
        return Effect.succeed([
          { accountId: account.accountId, platform: "instagram" },
        ]);
      }

      return access
        .withToken(account.channelId, (token) =>
          Effect.gen(function* linked() {
            const answer = yield* request(
              account,
              token.accessToken,
              "GET",
              "/me",
              { fields: "id,instagram_business_account{id}" }
            ).pipe(Effect.flatMap(http.execute), Effect.option);

            if (Option.isNone(answer) || !isSuccess(answer.value)) {
              return yield* new PlatformUnavailable();
            }

            return yield* nodeOf(answer.value).pipe(
              Effect.mapError(() => new PlatformUnavailable())
            );
          })
        )
        .pipe(
          Effect.map((page): readonly FollowedAccount[] => {
            const linked = Option.fromUndefinedOr(
              page.instagram_business_account?.id
            );

            return account.platform === "facebook"
              ? [
                  { accountId: account.accountId, platform: "facebook" },
                  ...Option.toArray(linked).map((accountId) => ({
                    accountId,
                    platform: "instagram" as const,
                  })),
                ]
              : [
                  { accountId: account.accountId, platform: "instagram" },
                  { accountId: page.id, platform: "facebook" },
                ];
          }),
          Effect.catchTags({
            ChannelUnusable: unusable,
            DatabaseError: databaseDown,
            TokenExpired: needsReconnect,
          })
        );
    };

    // The fields a subscription asks: the messages, and the account's own
    // from elsewhere (its echoes), so a change made in Meta's inbox is read.
    const fields = { subscribed_fields: "messages,message_echoes" };

    const platform: MessagePlatform = {
      follow: (account) => subscribing(account, "POST", fields),
      read,
      resume: (account, message) =>
        asAccount(
          account,
          () => undecided,
          (token) => lookUp(account, token, message)
        ),
      send: (account, message) =>
        asAccount(account, failed, (token) => create(account, token, message)),
      // Stopped only while no other channel of Peal's reads the messages of
      // an account the subscription carries. Only messages are read from
      // Meta's events: once comments come by events too, this must ask
      // after them as well.
      unfollow: (account, followedElsewhere: FollowedElsewhere) =>
        Effect.gen(function* unfollowing() {
          const accounts = yield* sharing(account);

          if (yield* followedElsewhere(accounts)) {
            return "unneeded" as const;
          }

          return yield* subscribing(account, "DELETE", {});
        }),
    };

    return platform;
  }
);
