import { maxKeywords } from "peal-contract";
import type { NewCommentRule } from "peal-contract";

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
 * Whether a rule may send a private reply on the platform: Instagram and
 * Facebook Pages, whose platforms let an account send a commenter one
 * private message. The server says whether the channel can, now.
 */
export const carriesPrivately = (platform: string | undefined): boolean =>
  platform === "instagram" || platform === "facebook";

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
