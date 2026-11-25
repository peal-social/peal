import { AsyncResult } from "effect/reactivity";
import { maxKeywords } from "peal-contract";
import type {
  Channel,
  CommentRule,
  NewCommentRule,
  Platform,
  PlatformCommentRule,
} from "peal-contract";

/** What the form holds while a member writes a rule. */
export interface CommentRuleDraft {
  readonly channelId: string;
  /** Comma-separated, as a member types them. */
  readonly keywords: string;
  /** The private message to send too; null when none is asked for. */
  readonly privateReply: string | null;
  readonly reply: string;
}

export const freshCommentRule: CommentRuleDraft = {
  channelId: "",
  keywords: "",
  privateReply: null,
  reply: "",
};

/**
 * The platforms where a rule answers, as the server says
 * (`automations.commentRules.platforms`), in its order.
 */
export const answeringPlatforms = (
  platforms: readonly PlatformCommentRule[]
): readonly Platform[] =>
  platforms.flatMap(({ platform, reply }) =>
    reply === "available" ? [platform] : []
  );

/**
 * The channels a rule may start on: those that are on and connected, on
 * a platform where the server says rules answer. The server still says
 * when one must be connected again for its comments.
 */
export const ruleChannelsOf = <C extends Pick<Channel, "platform" | "status">>(
  channels: readonly C[],
  platforms: readonly PlatformCommentRule[]
): readonly C[] => {
  const answering = new Set<Channel["platform"]>(answeringPlatforms(platforms));

  return channels.filter(
    ({ platform, status }) =>
      status._tag === "active" && answering.has(platform)
  );
};

/** A channel a rule could answer on but for its state, and its fix. */
export interface HeldChannel<C> {
  readonly channel: C;
  /** Turned off (`off`: turn it back on), or to connect again. */
  readonly fix: "off" | "reconnect";
}

/**
 * The channels on a platform where rules answer that `ruleChannelsOf`
 * leaves out for their state alone, each with what brings it back.
 */
export const heldChannelsOf = <C extends Pick<Channel, "platform" | "status">>(
  channels: readonly C[],
  platforms: readonly PlatformCommentRule[]
): readonly HeldChannel<C>[] => {
  const answering = new Set<Channel["platform"]>(answeringPlatforms(platforms));

  return channels.flatMap((channel) => {
    if (!answering.has(channel.platform) || channel.status._tag === "active") {
      return [];
    }

    return [
      {
        channel,
        fix: channel.status._tag === "disabled" ? "off" : "reconnect",
      } as const,
    ];
  });
};

/** What the rule form can draw from its two answers. */
export type RuleFormState<C> =
  | { readonly _tag: "failed" }
  | { readonly _tag: "loading" }
  | {
      readonly _tag: "ready";
      readonly channels: readonly C[];
      readonly platforms: readonly PlatformCommentRule[];
    };

/**
 * The rule form's state from the workspace's channels and where rules
 * answer: it fails when either failed, and waits for both.
 */
export const ruleFormStateOf = <C, E1, E2>(
  channels: AsyncResult.AsyncResult<readonly C[], E1>,
  platforms: AsyncResult.AsyncResult<readonly PlatformCommentRule[], E2>
): RuleFormState<C> => {
  if (AsyncResult.isFailure(channels) || AsyncResult.isFailure(platforms)) {
    return { _tag: "failed" };
  }

  return AsyncResult.isSuccess(channels) && AsyncResult.isSuccess(platforms)
    ? { _tag: "ready", channels: channels.value, platforms: platforms.value }
    : { _tag: "loading" };
};

/**
 * Whether a rule may send a private reply on the platform, as the server
 * says: Instagram and Facebook Pages, where it reads their messages. The
 * channel's own messages must be on too, which the server checks.
 */
export const carriesPrivately = (
  platforms: readonly PlatformCommentRule[],
  platform: Channel["platform"] | undefined
): boolean =>
  platforms.some(
    (each) => each.platform === platform && each.privateReply === "available"
  );

/**
 * Whether setting a paused rule going again is held back from the member:
 * a rule that sends private messages resumes only for one who may send
 * them, as the server refuses it otherwise.
 */
export const resumeHeld = (rule: CommentRule, mayMessage: boolean): boolean =>
  rule.holdsPrivateReply && !mayMessage;

/** The keywords a member typed, comma-separated, each trimmed. */
export const keywordsTyped = (typed: string): readonly string[] =>
  typed.split(",").flatMap((keyword) => {
    const kept = keyword.trim();

    return kept.length > 0 ? [kept] : [];
  });

/**
 * The request the form sends, or why not: no channel (`channel`), no
 * keyword or too many (`keywords`), no reply (`reply`), a private message
 * asked for but not written (`privateReply`). The server checks the rest.
 */
export const commentRuleRequestOf = (
  draft: CommentRuleDraft
): NewCommentRule | "channel" | "keywords" | "privateReply" | "reply" => {
  const keywords = keywordsTyped(draft.keywords);

  if (draft.channelId.length === 0) {
    return "channel";
  }

  if (keywords.length === 0 || keywords.length > maxKeywords) {
    return "keywords";
  }

  if (draft.reply.trim().length === 0) {
    return "reply";
  }

  const request = {
    channelId: draft.channelId,
    keywords,
    reply: draft.reply.trim(),
  };

  if (draft.privateReply === null) {
    return request;
  }

  const privateReply = draft.privateReply.trim();

  return privateReply.length === 0
    ? "privateReply"
    : { ...request, privateReply };
};
