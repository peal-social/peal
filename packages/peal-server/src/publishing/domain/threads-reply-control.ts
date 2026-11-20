import { Option, Schema } from "effect";

import type { AccountRestriction } from "./account-restriction.ts";
import type { ChannelOnPlatform } from "./content-rules.ts";
import type { ContentViolation } from "./content-violation.ts";
import type { TargetOptions } from "./target-options.ts";
import { ThreadsOptions } from "./threads-options.ts";

/**
 * The permission Threads asks of a post that says who may reply
 * (`reply_control`): without it, Meta refuses the post (403, code 10), as
 * the sandbox showed on 2026-11-20. Channels connected before Peal asked
 * for it have not granted it.
 */
export const threadsRepliesScope = "threads_manage_replies";

const isThreads = Schema.is(ThreadsOptions);

const grantsReplies = (scopes: readonly string[]) =>
  scopes.includes(threadsRepliesScope);

/**
 * Whether the options ask Threads for a reply setting: `everyone`,
 * Threads' default, is not sent, so it needs no permission.
 */
export const asksReplyControl = (options: ThreadsOptions): boolean =>
  options.replyControl !== undefined && options.replyControl !== "everyone";

/**
 * Who may reply, said beforehand: the option needs the channel connected
 * again while its scopes lack `threads_manage_replies`.
 */
export const replyControlRestrictions = (
  scopes: readonly string[]
): readonly AccountRestriction[] =>
  grantsReplies(scopes)
    ? []
    : [{ _tag: "optionNeedsReconnect", field: "replyControl" }];

/**
 * What scheduling refuses on a Threads channel whose scopes lack
 * `threads_manage_replies`: a reply setting other than everyone, as
 * invalid there (`replyControlRestrictions` says why).
 */
export const replyControlViolationsOn = (
  channel: ChannelOnPlatform,
  options: Option.Option<TargetOptions>,
  scopes: readonly string[]
): readonly ContentViolation[] =>
  Option.exists(
    options.pipe(Option.filter(isThreads)),
    (threads) => asksReplyControl(threads) && !grantsReplies(scopes)
  )
    ? [{ _tag: "optionInvalid", ...channel, field: "replyControl" }]
    : [];
