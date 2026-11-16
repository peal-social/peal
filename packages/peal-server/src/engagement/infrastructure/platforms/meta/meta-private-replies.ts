import { DateTime, Duration, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientResponse } from "effect/http";
import type { HttpClientResponse as Response } from "effect/http";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import type { ChannelAccount } from "#channels/application/channel-access.ts";
import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";
import type {
  PrivateReplyFailure,
  PrivateReplyOutcome,
} from "#engagement/domain/private-reply.ts";
import { messageRefusedWith } from "#engagement/infrastructure/platforms/channel-refusals.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";

import { isSuccess, nodePath, requestsWith } from "./meta-comments.ts";
import type { MetaEngagementOptions } from "./meta-comments.ts";
import { instantFrom } from "./meta-messages.ts";
import type { Paced } from "./meta-messages.ts";

// The one private reply a Page, or an Instagram professional account,
// sends the author of a comment under its post, from Meta's pages (read
// 2026-11-16):
//
// - Facebook Pages (developers.facebook.com/documentation/
//   business-messaging/messenger-platform/discovery/private-replies):
//   `POST /<PAGE_ID>/messages` with `recipient: { comment_id }`. "Only one
//   message can be sent to the person who commented"; "The message must be
//   sent within 7 days from when the post or comment was created"; "Only
//   when a person responds to the private message can you continue the
//   conversation within the 24-hour messaging window."
// - Instagram through a Page (…/instagram-messaging/features/
//   private-replies): the same call, "Only one message can be sent to the
//   Instagram user who commented", within 7 days of the comment; the
//   message lands in the person's inbox if they follow the account, in
//   their requests otherwise.
// - Instagram Login (…/instagram-platform/private-replies): `POST
//   graph.instagram.com/<version>/<IG_ID>/messages`, `{ recipient:
//   { comment_id }, message: { text } }`, the same two limits.
// - Errors (…/messenger-platform/error-codes, and the Graph reference of
//   `/{page_id}/messages`): `100`/`2534025` "The comment is invalid for a
//   private reply"; `10900` "Activity already replied to"; `10903` "This
//   user cant reply to this activity"; `10904` "The page has messages
//   disabled in the settings"; the person takes no message `551`,
//   `10`/`2018108`; not a role holder before review `200`/`2018028`; the
//   window `10`/`2018278`, `10`/`2534022`, `10`/`2018065`; the rate `613`,
//   `4`.
//
// The call takes no idempotency key and no tag: a private reply is inside
// the window the comment opened. Meta's one-message rule is the second
// guard, never the first, and its refusal does not say whose message the
// first one was. A resume never sends: it looks for the message in the
// person's conversation (`GET /me/conversations?user_id=…`), which is
// not verified to take a comment's author id; when it does not, a lost
// answer stays unconfirmed, which is safe. Written from those pages and
// never run against Meta: src/engagement/AGENTS.md lists what the
// sandbox's trial checks.

/** A private reply about to go out, read from its journal row and its comment. */
export interface OutgoingPrivateReply {
  /** When it was written: what a resume looks from, less a minute. */
  readonly createdAt: DateTime.Utc;
  readonly privateReplyId: PrivateReplyId;
  /** The comment it answers, by its id on the platform, as kept. */
  readonly platformCommentId: string;
  /** Who wrote the comment, by their id on the platform; none once forgotten. */
  readonly commentAuthorId: Option.Option<string>;
  /**
   * The platform's ids of the messages Peal sent as the account, other
   * than this one: a resume never takes one of them for this one.
   */
  readonly takenIds: readonly string[];
  readonly text: string;
}

/** One platform's private replies: Facebook Pages and Instagram. */
export interface PrivateReplyPlatform {
  readonly send: (
    account: ChannelAccount,
    reply: OutgoingPrivateReply
  ) => Effect.Effect<PrivateReplyOutcome>;
  readonly resume: (
    account: ChannelAccount,
    reply: OutgoingPrivateReply
  ) => Effect.Effect<PrivateReplyOutcome>;
}

export interface MetaPrivateRepliesOptions extends MetaEngagementOptions {
  /** The pace the account's conversations are read at, with the messages' adapter. */
  readonly paced: Paced;
}

/** How long before a message was written its copy on Meta may say it was sent. */
const clockSkew = Duration.minutes(1);

// The latest messages of a conversation a resume looks among: those Meta
// details.
const lookedAmong = 20;

const SentSchema = Schema.Struct({ message_id: Schema.NonEmptyString });

const sentOf = HttpClientResponse.schemaBodyJson(SentSchema);

// Meta's error, by its code and subcode alone: its message may quote what
// was sent.
const ErrorSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.optionalKey(Schema.Number),
    error_subcode: Schema.optionalKey(Schema.Number),
    is_transient: Schema.optionalKey(Schema.Boolean),
  }),
});

const errorOf = (response: Response.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ErrorSchema)(response).pipe(
    Effect.map(({ error }) => ({
      code: error.code ?? 0,
      subcode: error.error_subcode ?? 0,
      transient: error.is_transient ?? false,
    })),
    Effect.orElseSucceed(() => ({ code: 0, subcode: 0, transient: false }))
  );

const ConversationsSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.NonEmptyString,
      participants: Schema.optionalKey(
        Schema.Struct({
          data: Schema.Array(Schema.Struct({ id: Schema.String })),
        })
      ),
    })
  ),
});

const conversationsOf = HttpClientResponse.schemaBodyJson(ConversationsSchema);

const MessagesSchema = Schema.Struct({
  messages: Schema.optionalKey(
    Schema.Struct({
      data: Schema.Array(
        Schema.Struct({
          created_time: Schema.optionalKey(
            Schema.Union([Schema.String, Schema.Number])
          ),
          from: Schema.optionalKey(Schema.Struct({ id: Schema.String })),
          id: Schema.NonEmptyString,
          message: Schema.optionalKey(Schema.String),
        })
      ),
    })
  ),
});

const messagesOf = HttpClientResponse.schemaBodyJson(MessagesSchema);

const unanswered: PrivateReplyOutcome = {
  _tag: "unconfirmed",
  reason: "noResponse",
};

const undecided: PrivateReplyOutcome = {
  _tag: "unconfirmed",
  reason: "interrupted",
};

const failed = (reason: PrivateReplyFailure): PrivateReplyOutcome => ({
  _tag: "failed",
  reason,
});

/**
 * Why Meta refused a private reply, by its code and subcode, where its
 * pages say nothing was sent; none for any other answer, which may follow
 * a message that went out, so it is left unconfirmed.
 */
export const privateReplyRefusal = (
  code: number,
  subcode: number
): Option.Option<PrivateReplyFailure> => {
  // The comment is not one a private reply may answer (deleted, or of a
  // kind Meta does not take).
  if (code === 100 && subcode === 2_534_025) {
    return Option.some("commentGone");
  }

  // Answered privately already, from somewhere other than this request.
  if (code === 10_900) {
    return Option.some("alreadyAnswered");
  }

  // Outside the allowed window.
  if (
    code === 10 &&
    (subcode === 2_018_278 || subcode === 2_534_022 || subcode === 2_018_065)
  ) {
    return Option.some("windowClosed");
  }

  if (code === 613 || code === 4) {
    return Option.some("rateLimited");
  }

  // The person may not get one (`10903`), the Page's messages are off
  // (`10904`), Meta deems the action abusive or otherwise disallowed
  // (`368`), or refuses it as the Graph reference of `/{page-id}/messages`
  // lists it beside them (`2022`), the person takes no message from the account (`551`,
  // `10`/`2018108`), the app may not write to them before its review
  // (`200`/`2018028`), or the request is invalid as sent (10, 100, 200 to
  // 299).
  return code === 10_903 ||
    code === 10_904 ||
    code === 368 ||
    code === 2022 ||
    code === 551 ||
    code === 10 ||
    code === 100 ||
    (code >= 200 && code <= 299)
    ? Option.some("refused")
    : Option.none();
};

const listedPlatform = (account: ChannelAccount) =>
  account.platform === "facebook" ? "messenger" : "instagram";

/**
 * Facebook Pages' and Instagram's private replies, through each way in:
 * the way in (`ChannelAccount.connection`) decides the host, the token
 * and whether calls carry the proof (`graphRequest`). Logs hold ids and
 * codes, never a text, a commenter or Meta's words.
 */
export const metaPrivateReplies = Effect.fn("MetaPrivateReplies.make")(
  function* metaPrivateReplies(options: MetaPrivateRepliesOptions) {
    const access = yield* ChannelAccess;
    const request = yield* requestsWith(options);
    const { http, paced } = options;

    // A call as the account, whose failures to get a token each mean
    // nothing was sent.
    const asAccount = (
      account: ChannelAccount,
      onRefused: (reason: PrivateReplyFailure) => PrivateReplyOutcome,
      use: (
        token: Redacted.Redacted
      ) => Effect.Effect<PrivateReplyOutcome, TokenRejected>
    ): Effect.Effect<PrivateReplyOutcome> =>
      access
        .withToken(account.channelId, ({ accessToken }) => use(accessToken))
        .pipe(
          Effect.catch(
            messageRefusedWith((reason) =>
              onRefused(
                reason === "channelUnavailable" || reason === "reconnectNeeded"
                  ? reason
                  : "platformUnavailable"
              )
            )
          )
        );

    const create = Effect.fn("MetaPrivateReplies.send")(function* create(
      account: ChannelAccount,
      token: Redacted.Redacted,
      reply: OutgoingPrivateReply
    ) {
      // The comment's id as kept, and no tag: Meta takes the comment as
      // the recipient, and the message is inside the window it opened.
      const sent = yield* request(account, token, "POST", "/me/messages", {
        message: JSON.stringify({ text: reply.text }),
        recipient: JSON.stringify({ comment_id: reply.platformCommentId }),
      }).pipe(Effect.flatMap(http.execute), Effect.result);

      // The request may have reached Meta.
      if (sent._tag === "Failure") {
        return unanswered;
      }

      const response = sent.success;

      if (isSuccess(response)) {
        return yield* sentOf(response).pipe(
          Effect.map(({ message_id: id }): PrivateReplyOutcome => ({
            _tag: "sent",
            platformMessageId: id,
          })),
          Effect.orElseSucceed(() => unanswered)
        );
      }

      if (response.status >= 500) {
        return unanswered;
      }

      const { code, subcode, transient } = yield* errorOf(response);

      // Refused before anything was made: a renewed token may be tried.
      if (code === 190 || code === 102) {
        return yield* new TokenRejected();
      }

      const refusal = transient
        ? Option.none<PrivateReplyFailure>()
        : privateReplyRefusal(code, subcode);

      const ids = {
        channelId: account.channelId,
        code,
        privateReplyId: reply.privateReplyId,
        subcode,
      };

      // Meta's own failure, or an answer that says nothing Peal knows:
      // the message may be out, and is never sent again.
      if (Option.isNone(refusal)) {
        yield* Effect.logWarning(
          "Meta answered a private reply ambiguously"
        ).pipe(Effect.annotateLogs(ids));

        return unanswered;
      }

      // Codes alone: Meta's message may quote the text.
      yield* Effect.logWarning("Meta refused a private reply").pipe(
        Effect.annotateLogs(ids)
      );

      return failed(refusal.value);
    });

    // A Graph read as the account, once its slot came: its answer when it
    // succeeded, none otherwise.
    const read = (
      account: ChannelAccount,
      token: Redacted.Redacted,
      path: string,
      params: Readonly<Record<string, Redacted.Redacted | string>>
    ) =>
      paced(account).pipe(
        Effect.andThen(request(account, token, "GET", path, params)),
        Effect.flatMap(http.execute),
        Effect.option,
        Effect.map(Option.filter(isSuccess))
      );

    // Looks for the message in the person's conversation: exactly one
    // conversation with them, and in it exactly one of the account's
    // messages, written since the private reply was (less a minute), with
    // its text, that no other message of Peal's holds. Anything else, or
    // a read that failed, is unconfirmed: never sent again.
    const lookUp = Effect.fn("MetaPrivateReplies.lookUp")(function* lookUp(
      account: ChannelAccount,
      token: Redacted.Redacted,
      reply: OutgoingPrivateReply
    ) {
      if (Option.isNone(reply.commentAuthorId)) {
        return undecided;
      }

      const listed = yield* read(account, token, "/me/conversations", {
        fields: "id,participants",
        platform: listedPlatform(account),
        // Who commented, hidden from the call's span as a token is.
        user_id: Redacted.make(reply.commentAuthorId.value),
      });

      const found = yield* Option.match(listed, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (answer) => conversationsOf(answer).pipe(Effect.option),
      });

      const [only, ...others] = Option.match(found, {
        onNone: () => [],
        onSome: ({ data }) => data,
      });

      // The one conversation, and the commenter in it: Meta is not
      // trusted to have filtered the list by them.
      if (
        only === undefined ||
        others.length > 0 ||
        !(only.participants?.data ?? []).some(
          ({ id }) => id === reply.commentAuthorId.value
        )
      ) {
        return undecided;
      }

      const thread = yield* read(account, token, nodePath(only.id), {
        fields: `messages.limit(${String(lookedAmong)}){id,created_time,from,message}`,
      });

      const latest = yield* Option.match(thread, {
        onNone: () => Effect.succeed(Option.none()),
        onSome: (answer) => messagesOf(answer).pipe(Effect.option),
      });

      if (Option.isNone(latest)) {
        return undecided;
      }

      const since = DateTime.subtractDuration(reply.createdAt, clockSkew);
      const taken = new Set(reply.takenIds);

      const matching = (latest.value.messages?.data ?? []).filter(
        (message) =>
          message.from?.id === account.accountId &&
          message.message === reply.text &&
          !taken.has(message.id) &&
          Option.fromUndefinedOr(message.created_time).pipe(
            Option.flatMap(instantFrom),
            Option.exists((at) => DateTime.isGreaterThanOrEqualTo(at, since))
          )
      );

      const [match] = matching;

      return matching.length === 1 && match !== undefined
        ? ({ _tag: "sent", platformMessageId: match.id } as const)
        : undecided;
    });

    const platform: PrivateReplyPlatform = {
      resume: (account, reply) =>
        asAccount(
          account,
          () => undecided,
          (token) => lookUp(account, token, reply)
        ),
      send: (account, reply) =>
        asAccount(account, failed, (token) => create(account, token, reply)),
    };

    return platform;
  }
);
