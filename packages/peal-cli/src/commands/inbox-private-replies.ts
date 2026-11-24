import { Console, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  idempotencyKeyLifetimeHours,
  InboxPrivateReplySchema,
  maxIdempotencyKeyLength,
  privateReplyWindowDays,
} from "peal-contract";
import type { InboxPrivateReply, InboxPrivateReplyReason } from "peal-contract";

import { confirmed, neverAsksInJson, yesFlagName } from "#confirm.ts";
import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { instant } from "#print.ts";
import { Refused } from "#refused.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

const checkThen =
  "check the person's conversation, then run peal inbox private-reply confirm";

const reasons: Readonly<Record<InboxPrivateReplyReason, string>> = {
  adapterFailure: `a fault in Peal after the request may have left: ${checkThen}`,
  alreadyAnswered:
    "the platform says the comment had its one private reply already, sent from elsewhere",
  channelUnavailable:
    "the channel was disconnected or turned off, or its messages were turned off",
  commentGone: "the platform no longer takes the comment for a private reply",
  interrupted: `the server stopped during the call: ${checkThen}`,
  noResponse: `the request left and no answer came back: ${checkThen}`,
  notSent: "it never went out",
  platformUnavailable: "the platform did not answer",
  rateLimited: "the platform asked to slow down",
  reconnectNeeded: "the platform refuses the channel's token: reconnect it",
  refused:
    "the platform refused it: the person may take no messages from the account, or the Page's messages are off",
  windowClosed: `the platform's ${String(privateReplyWindowDays)} days had passed`,
};

/** A private reply's state, in words: what the thread prints. */
export const privateReplyLine = (reply: InboxPrivateReply): string =>
  `${reply.status}${reply.reason === null ? "" : `: ${reasons[reply.reason]}`}`;

const privateReplyArgument = Argument.String("private-reply-id").pipe(
  Argument.withDescription(
    "The private reply, as peal inbox thread shows its id."
  )
);

// Refused before any request: the server would refuse the key too.
const keyChecked = (key: Option.Option<string>) =>
  Option.exists(
    key,
    (given) => given === "" || given.length > maxIdempotencyKeyLength
  )
    ? Effect.fail(
        new Refused({
          reason: `--idempotency-key takes 1 to ${String(maxIdempotencyKeyLength)} characters.`,
        })
      )
    : Effect.void;

const yes = Flag.Boolean(yesFlagName).pipe(
  Flag.withDescription(
    "Send without asking: the person who decides agreed to exactly this message."
  ),
  Flag.withDefault(false)
);

const send = Command.make(
  "send",
  {
    commentId: Argument.String("comment-id").pipe(
      Argument.withDescription(
        "The comment whose author gets the message, as peal inbox thread shows its id."
      )
    ),
    idempotencyKey: Flag.String("idempotency-key").pipe(
      Flag.withMetavar("<key>"),
      Flag.withDescription(
        `Any text of your choosing, ${String(maxIdempotencyKeyLength)} characters at most, such as a UUID, that makes the command safe to run again: within ${String(idempotencyKeyLifetimeHours)} hours, the same key with the same text to the same comment answers the private reply the first run made, and sends no other.`
      ),
      Flag.optional
    ),
    json: jsonFlag,
    text: Flag.String("text").pipe(
      Flag.withMetavar("<text>"),
      Flag.withDescription(
        "What the message says. Where the law asks that an automated message say so, say it here."
      )
    ),
    workspace: workspaceFlag,
    yes,
  },
  Effect.fn("inbox.privateReply.send")(function* sending(flags) {
    yield* keyChecked(flags.idempotencyKey);
    yield* neverAsksInJson({
      json: flags.json,
      why: "a private reply goes to a real person and cannot be taken back",
      yes: flags.yes,
    });

    const { client, url } = yield* inWorkspace(flags.workspace);

    if (!flags.json) {
      yield* Console.log(
        `This sends the author of comment ${flags.commentId} one private message, as the channel's account. It cannot be taken back, the platform takes one a comment, and the person must answer before the account can write again:`
      );
      yield* Console.log(`  ${flags.text}`);
    }

    yield* confirmed({ question: "Send it?", yes: flags.yes });

    const sent = yield* client.inboxMessages
      .sendPrivateReply({
        headers: Option.match(flags.idempotencyKey, {
          onNone: () => ({}),
          onSome: (key) => ({ "idempotency-key": key }),
        }),

        payload: { commentId: flags.commentId, text: flags.text },
      })
      .pipe(Effect.mapError(explain(url)));

    if (flags.json) {
      yield* printJson(InboxPrivateReplySchema, sent);

      return;
    }

    yield* Console.log(
      `Private reply ${sent.id} is on its way, as the channel's account: peal inbox private-reply show ${sent.id} shows how it ended.`
    );
  })
).pipe(
  Command.withDescription(
    `Send the author of a comment on Instagram or a Facebook Page one private message, as the channel's account, within ${String(privateReplyWindowDays)} days of the comment, where the channel's direct messages are on. It goes to a real person and cannot be taken back; asks first unless --yes. Needs a sign-in that may publish.`
  )
);

const show = Command.make(
  "show",
  {
    json: jsonFlag,
    privateReplyId: privateReplyArgument,
    workspace: workspaceFlag,
  },
  Effect.fn("inbox.privateReply.show")(function* showing(flags) {
    const { client, url } = yield* inWorkspace(flags.workspace);

    const found = yield* client.inboxMessages
      .getPrivateReply({
        headers: {},
        params: {
          privateReplyId: flags.privateReplyId,
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (flags.json) {
      yield* printJson(InboxPrivateReplySchema, found);

      return;
    }

    yield* Console.log(
      `Private reply ${found.id} to comment ${found.commentId}, written ${instant(found.createdAt)}: ${privateReplyLine(found)}.`
    );
    yield* Console.log(`  ${found.text}`);
  })
).pipe(
  Command.withDescription(
    "Show a private reply sent to a comment's author, and how it stands."
  )
);

const confirm = Command.make(
  "confirm",
  {
    json: jsonFlag,
    notSent: Flag.Boolean("not-sent").pipe(
      Flag.withDescription("It never went out: the comment may get another."),
      Flag.withDefault(false)
    ),
    privateReplyId: privateReplyArgument,
    sent: Flag.Boolean("sent").pipe(
      Flag.withDescription("It is in the person's conversation."),
      Flag.withDefault(false)
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("inbox.privateReply.confirm")(function* confirming(flags) {
    yield* flags.sent === flags.notSent
      ? Effect.fail(
          new Refused({
            reason:
              "Say what you found in the person's conversation: --sent, or --not-sent.",
          })
        )
      : Effect.void;

    const { client, url } = yield* inWorkspace(flags.workspace);

    const settled = yield* client.inboxMessages
      .confirmPrivateReply({
        headers: {},
        params: {
          privateReplyId: flags.privateReplyId,
        },
        payload: { went: flags.sent },
      })
      .pipe(Effect.mapError(explain(url)));

    if (flags.json) {
      yield* printJson(InboxPrivateReplySchema, settled);

      return;
    }

    yield* Console.log(
      `Private reply ${settled.id}: ${privateReplyLine(settled)}.`
    );
  })
).pipe(
  Command.withDescription(
    "Record what you found in the person's conversation for a private reply Peal could not confirm: --sent, or --not-sent."
  )
);

export const privateReply = Command.make("private-reply").pipe(
  Command.withDescription(
    `The one private message a comment's author may get from the channel's account, on Instagram and Facebook Pages: send it, within ${String(privateReplyWindowDays)} days of the comment and where the channel's direct messages are on, show it, and settle one Peal could not confirm.`
  ),
  Command.withSubcommands([send, show, confirm])
);
