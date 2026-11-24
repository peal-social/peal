import { Console, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  CommentRulePageSchema,
  CommentRuleSchema,
  CommentRuleStatusSchema,
  maxKeywords,
} from "peal-contract";
import type { CommentRule, CommentRuleChange } from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson, printNothing } from "#json.ts";
import { excerpt } from "#print.ts";
import { Refused } from "#refused.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

const ruleArgument = Argument.String("rule").pipe(
  Argument.withDescription(
    "The comment rule, by its id, as peal inbox rules list shows it."
  )
);

const keywordFlag = Flag.String("keyword").pipe(
  Flag.withMetavar("<word>"),
  Flag.withDescription(
    `A word, or words, a comment must hold for the rule to answer it, whatever its case and accents; repeat it, ${String(maxKeywords)} at most.`
  ),
  Flag.atLeast(0)
);

const replyFlag = Flag.String("reply").pipe(
  Flag.withMetavar("<text>"),
  Flag.withDescription(
    "What the rule answers, in public, as the channel's account."
  )
);

const privateReplyFlag = Flag.String("private-reply").pipe(
  Flag.withMetavar("<text>"),
  Flag.withDescription(
    "A private message the rule also sends the author of each comment it answers, once its public reply is out: on Instagram and Facebook Pages only, where the channel's direct messages are on, once a comment, within 7 days of it. It goes to real people by itself: say in it that it is automatic where the law asks."
  ),
  Flag.optional
);

const summary = (rule: CommentRule): string =>
  [
    rule.keywords.join(", "),
    rule.status === "ended"
      ? `ended: ${rule.endedReason ?? "stopped"}`
      : rule.status,
  ].join(" · ");

// What came of a match's private reply, when its rule has one.
const privateOutcome = (match: CommentRule["matches"][number]): string => {
  if (match.privateReplyId !== null) {
    return `, private reply ${match.privateStatus ?? "made"} ${match.privateReplyId}`;
  }

  return match.privateCode === null
    ? ""
    : `, no private reply (${match.privateCode})`;
};

const scopeOf = (rule: CommentRule) =>
  rule.postId === null
    ? `channel ${rule.channelId ?? ""}`
    : `post ${rule.postId}`;

const printRule = (rule: CommentRule, json: boolean, said: string) =>
  json
    ? printJson(CommentRuleSchema, rule)
    : Effect.gen(function* printed() {
        yield* Console.log(`${said} (${summary(rule)}): ${rule.id}.`);
        yield* Console.log(`  reply: ${excerpt(rule.reply)}`);

        if (rule.privateReply !== null) {
          yield* Console.log(`  private reply: ${excerpt(rule.privateReply)}`);
        }

        for (const {
          channelId,
          platform,
          privateReply,
          reply,
        } of rule.channels) {
          yield* Console.log(
            rule.privateReply === null
              ? `  ${platform} ${channelId}: ${reply}`
              : `  ${platform} ${channelId}: ${reply}, private reply ${privateReply}`
          );
        }

        for (const match of rule.matches) {
          yield* Console.log(
            `  comment ${match.commentId}: ${match.outcome}${match.code === null ? "" : ` (${match.code})`}${privateOutcome(match)}`
          );
        }
      });

const list = Command.make(
  "list",
  {
    json: jsonFlag,
    status: Flag.Literals("status", CommentRuleStatusSchema.literals).pipe(
      Flag.withDescription("Only the rules with this status."),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("inboxRules.list")(function* list(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const page = yield* client.inboxRules
      .listCommentRules({
        headers: {},
        query: Option.match(input.status, {
          onNone: () => ({}),
          onSome: (status) => ({ status }),
        }),
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      return yield* printJson(CommentRulePageSchema, page);
    }

    if (page.items.length === 0) {
      return yield* Console.log(
        `${workspace.name} answers no comment by itself: peal inbox rules start makes a rule.`
      );
    }

    return yield* Console.log(
      [
        `Comment rules of ${workspace.name}:`,
        ...page.items.map(
          (rule) => `  ${rule.id}  ${scopeOf(rule)}  ${summary(rule)}`
        ),
      ].join("\n")
    );
  })
).pipe(
  Command.withDescription(
    "List the workspace's comment rules: where each answers, its keywords and where it is."
  )
);

const show = Command.make(
  "show",
  { json: jsonFlag, rule: ruleArgument, workspace: workspaceFlag },
  Effect.fn("inboxRules.show")(function* show(input) {
    const { client, url } = yield* inWorkspace(input.workspace);

    const rule = yield* client.inboxRules
      .getCommentRule({
        headers: {},
        params: { ruleId: input.rule },
      })
      .pipe(Effect.mapError(explain(url)));

    return yield* printRule(rule, input.json, `Rule on ${scopeOf(rule)}`);
  })
).pipe(
  Command.withDescription(
    "Show a comment rule, what each of its channels can carry, and the comments it matched with what came of each."
  )
);

const start = Command.make(
  "start",
  {
    channel: Flag.String("channel").pipe(
      Flag.withMetavar("<id>"),
      Flag.withDescription(
        "The channel whose posts' comments the rule answers."
      ),
      Flag.optional
    ),
    json: jsonFlag,
    keywords: keywordFlag,
    post: Flag.String("post").pipe(
      Flag.withMetavar("<id>"),
      Flag.withDescription(
        "The post, out already, whose comments the rule answers."
      ),
      Flag.optional
    ),
    privateReply: privateReplyFlag,
    reply: replyFlag,
    workspace: workspaceFlag,
  },
  Effect.fn("inboxRules.start")(function* start(input) {
    if (Option.isSome(input.post) === Option.isSome(input.channel)) {
      return yield* new Refused({
        reason:
          "Give --post or --channel, one of them: whose comments the rule answers.",
      });
    }

    if (input.keywords.length === 0 || input.keywords.length > maxKeywords) {
      return yield* new Refused({
        reason: `Give 1 to ${String(maxKeywords)} --keyword: what a comment must hold.`,
      });
    }

    const { client, url } = yield* inWorkspace(input.workspace);

    const rule = yield* client.inboxRules
      .createCommentRule({
        headers: {},
        payload: {
          keywords: input.keywords,
          reply: input.reply,
          ...Option.match(input.privateReply, {
            onNone: () => ({}),
            onSome: (privateReply) => ({ privateReply }),
          }),
          ...Option.match(input.post, {
            onNone: () => ({}),
            onSome: (postId) => ({ postId }),
          }),
          ...Option.match(input.channel, {
            onNone: () => ({}),
            onSome: (channelId) => ({ channelId }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    return yield* printRule(
      rule,
      input.json,
      `Answering comments on ${scopeOf(rule)}`
    );
  })
).pipe(
  Command.withDescription(
    "Make a rule that answers, by itself and in public, the comments that hold a --keyword, with --reply: once a comment and once a person, 25 a day at most. It answers on Mastodon, and on Facebook Pages and Instagram where the server reads them; Bluesky's, X's, LinkedIn's and YouTube's rules forbid it. With --private-reply, it also sends each comment's author one private message after its public reply, on Instagram and Facebook Pages."
  )
);

const update = Command.make(
  "update",
  {
    json: jsonFlag,
    keywords: keywordFlag,
    noPrivateReply: Flag.Boolean("no-private-reply").pipe(
      Flag.withDescription(
        "Take the rule's private reply off: it sends none after."
      )
    ),
    privateReply: privateReplyFlag,
    reply: replyFlag.pipe(Flag.optional),
    rule: ruleArgument,
    workspace: workspaceFlag,
  },
  Effect.fn("inboxRules.update")(function* update(input) {
    if (Option.isSome(input.privateReply) && input.noPrivateReply) {
      return yield* new Refused({
        reason: "Give --private-reply or --no-private-reply, not both.",
      });
    }

    const payload: {
      -readonly [K in keyof CommentRuleChange]: CommentRuleChange[K];
    } = {};

    if (input.keywords.length > 0) {
      payload.keywords = input.keywords;
    }

    if (Option.isSome(input.reply)) {
      payload.reply = input.reply.value;
    }

    if (Option.isSome(input.privateReply)) {
      payload.privateReply = input.privateReply.value;
    }

    if (input.noPrivateReply) {
      payload.privateReply = null;
    }

    if (Object.keys(payload).length === 0) {
      return yield* new Refused({
        reason:
          "Give --keyword, --reply, --private-reply or --no-private-reply: nothing else of a rule changes.",
      });
    }

    const { client, url } = yield* inWorkspace(input.workspace);

    const rule = yield* client.inboxRules
      .updateCommentRule({
        headers: {},
        params: { ruleId: input.rule },
        payload,
      })
      .pipe(Effect.mapError(explain(url)));

    return yield* printRule(rule, input.json, `Rule ${rule.id} changed`);
  })
).pipe(
  Command.withDescription(
    "Change a rule's keywords (--keyword replaces them all), its reply or its private reply."
  )
);

const pausing = (paused: boolean) =>
  Effect.fn("inboxRules.pause")(function* pause(input: {
    readonly json: boolean;
    readonly rule: string;
    readonly workspace: Option.Option<string>;
  }) {
    const { client, url } = yield* inWorkspace(input.workspace);

    const rule = yield* client.inboxRules
      .updateCommentRule({
        headers: {},
        params: { ruleId: input.rule },
        payload: { paused },
      })
      .pipe(Effect.mapError(explain(url)));

    return yield* printRule(
      rule,
      input.json,
      `${paused ? "Paused" : "Resumed"} rule ${rule.id}`
    );
  });

const pause = Command.make(
  "pause",
  { json: jsonFlag, rule: ruleArgument, workspace: workspaceFlag },
  pausing(true)
).pipe(
  Command.withDescription(
    "Pause a rule: it answers nothing, and never the comments received meanwhile."
  )
);

const resume = Command.make(
  "resume",
  { json: jsonFlag, rule: ruleArgument, workspace: workspaceFlag },
  pausing(false)
).pipe(Command.withDescription("Set a paused rule going again."));

const stop = Command.make(
  "stop",
  { json: jsonFlag, rule: ruleArgument, workspace: workspaceFlag },
  Effect.fn("inboxRules.stop")(function* stop(input) {
    const { client, url } = yield* inWorkspace(input.workspace);

    yield* client.inboxRules
      .deleteCommentRule({
        headers: {},
        params: { ruleId: input.rule },
      })
      .pipe(Effect.mapError(explain(url)));

    return yield* input.json
      ? printNothing
      : Console.log(
          `Stopped rule ${input.rule}: it answers nothing more, and its replies stay.`
        );
  })
).pipe(Command.withDescription("Stop a rule for good: its replies stay."));

export const rules = Command.make("rules").pipe(
  Command.withDescription(
    "Rules that answer comments holding a keyword, by themselves, in public, as the channel's account, and, with a private reply, privately to each comment's author once on Instagram and Facebook Pages. They never like or follow anyone, nor write to anyone who did not comment."
  ),
  Command.withSubcommands([list, show, start, update, pause, resume, stop])
);
