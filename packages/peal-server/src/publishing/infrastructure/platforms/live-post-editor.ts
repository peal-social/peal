import type { Effect, Option } from "effect";

import type {
  EditOutcome,
  RemovalFailure,
} from "#publishing/application/live-post-clients.ts";
import type { PendingSiteEdit } from "#publishing/application/live-post-edits.ts";
import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import type { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

/**
 * What an edit replaces on the platform: one post's text, nothing else,
 * but on a website, where it is the article's content and its options.
 */
export interface TextEdit {
  /** The channel the post is on. */
  readonly channelId?: ChannelId;
  /**
   * The part's media on the channel, with their alt text, which a platform
   * may need sent again with the text (Slack's image blocks).
   */
  readonly media: readonly MediaAttachment[];
  /** The target's options, which a platform may need sent again. */
  readonly options: Option.Option<TargetOptions>;
  readonly platformPostId: PlatformPostId;
  /**
   * What a website's editor needs besides: its target, its workspace and
   * its rich text once edited (`LivePostEdits`).
   */
  readonly site?: PendingSiteEdit;
  readonly text: string;
}

/**
 * Replaces the text of one post, or one part of a thread, on a platform
 * with the channel's token, keeping everything else of it: `edited` once
 * the platform shows the new text. Safe to repeat, as the same text again
 * changes nothing. A post the platform no longer has is `BadRequest`
 * `postGone`; a token it refused before doing anything is `TokenRejected`,
 * which the channels context renews once. A post Peal cannot tell is the
 * account's is refused before anything is sent (`invalidPlatformId`).
 */
export type LivePostEditor = (
  token: PublishingToken,
  edit: TextEdit
) => Effect.Effect<EditOutcome, RemovalFailure | TokenRejected>;

/** The code of an edit of a post the platform no longer has. */
export const postGone = "postGone";
