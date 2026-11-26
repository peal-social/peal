import { Schema } from "effect";

import { maxBodyMarkdownLength, maxPostTextLength } from "./post-text.ts";
import { RichTextSchema } from "./rich-text.ts";
import { TargetOptionsSchema } from "./target-options.ts";

/**
 * Why a post cannot be changed on a channel now:
 *
 * - `notPublished`: it is not live there (still sending, failed, waiting
 *   to be checked, cancelled).
 * - `alreadyRemoved`: Peal deleted it from the platform already.
 * - `noPlatformId`: Peal has no id for it, or for one of its parts, as for
 *   a post a member confirmed by hand.
 * - `notSupported`: the platform has no call for it, or Peal lacks the
 *   permission: the platform's capabilities say which (`livePost`).
 * - `changeInProgress`: another change of the post on that channel is
 *   pending.
 * - `channelUnavailable`: the channel is disconnected, turned off, or must
 *   be reconnected.
 * - `boostRunning`: a boost that is not over shows the post: stop it
 *   first.
 * - `approvalRequired`: your posts need an approval, and an edit would put
 *   text nobody approved out at once: an approver makes it.
 * - `deletionWindowPassed`: the platform deletes a post only for a time
 *   after it went out (Telegram: 48 hours), and that time has passed:
 *   delete it in the app itself.
 *
 * An edit is refused `noPlatformId` too for a part the post does not have
 * live on that channel.
 */
export const LivePostRefusalSchema = Schema.Literals([
  "notPublished",
  "alreadyRemoved",
  "noPlatformId",
  "notSupported",
  "changeInProgress",
  "channelUnavailable",
  "boostRunning",
  "approvalRequired",
  "deletionWindowPassed",
]).annotate({ identifier: "LivePostRefusal" });

export type LivePostRefusal = typeof LivePostRefusalSchema.Type;

/**
 * What a change of a live post does: `unpublish` deletes it, `edit`
 * replaces the text of one of its parts. More kinds may come (a new value
 * of this enum).
 */
export const LivePostChangeKindSchema = Schema.Literals([
  "unpublish",
  "edit",
]).annotate({ identifier: "LivePostChangeKind" });

export type LivePostChangeKind = typeof LivePostChangeKindSchema.Type;

/** Where a change of a live post stands. */
export const LivePostChangeStatusSchema = Schema.Literals([
  "pending",
  "done",
  "failed",
]).annotate({ identifier: "LivePostChangeStatus" });

export type LivePostChangeStatus = typeof LivePostChangeStatusSchema.Type;

/**
 * A change asked of a post that is live on one channel: `unpublish`
 * deletes it from the platform, every part of it, the last part of a
 * thread first; `edit` replaces the text of one part (`partsLeft` is 1
 * until it is done). `pending` while Peal deletes or edits the parts left
 * (`partsLeft`), `done` once none is, `failed` when Peal gave up: `code`
 * says why (`unavailable`, `rateLimited`, `channelUnavailable`, or the
 * platform's own code, as `postGone` when the platform no longer has the
 * post), and asking again deletes the parts left, or makes the edit anew.
 * The change never holds an edit's text.
 */
export const LivePostChangeSchema = Schema.Struct({
  // Whether the platform had a part no longer, as when it was deleted
  // there before; left out until one was found so.
  alreadyGone: Schema.optionalKey(Schema.Boolean),
  // Why it failed, once it has.
  code: Schema.NullOr(Schema.String),
  finishedAt: Schema.NullOr(Schema.DateTimeUtc),
  id: Schema.String,
  kind: LivePostChangeKindSchema,
  // How many parts are still to delete, or to edit: 0 once done.
  partsLeft: Schema.Int,
  postId: Schema.String,
  requestedAt: Schema.DateTimeUtc,
  status: LivePostChangeStatusSchema,
  targetId: Schema.String,
}).annotate({ identifier: "LivePostChange" });

export type LivePostChange = typeof LivePostChangeSchema.Type;

/** A channel of the post that could not be unpublished, and why. */
export const LivePostRefusedTargetSchema = Schema.Struct({
  reason: LivePostRefusalSchema,
  targetId: Schema.String,
}).annotate({ identifier: "LivePostRefusedTarget" });

export type LivePostRefusedTarget = typeof LivePostRefusedTargetSchema.Type;

/**
 * What asking to unpublish a whole post made: a change on each channel
 * where it can be, and why not on the others.
 */
export const PostUnpublishSchema = Schema.Struct({
  changes: Schema.Array(LivePostChangeSchema),
  refused: Schema.Array(LivePostRefusedTargetSchema),
}).annotate({ identifier: "PostUnpublish" });

export type PostUnpublish = typeof PostUnpublishSchema.Type;

/**
 * An edit of a live post on one channel. On a social network or a chat:
 * `text` for the part at `part` (from 0, the post itself, which it is when
 * left out), and only the text changes. On a website: its text there
 * (`text`, which replaces a rich text with plain paragraphs: send `body`
 * to keep its formatting, or a rich text, `body`, or the same as
 * Markdown, `bodyMarkdown`, read as `TextOverride.bodyMarkdown` is) and
 * its options (`options`, its platform's, whole: an option left out of
 * them is left out on the site, but for `siteStatus`, which is the
 * target's), each kept as it is when left out; its site status and its
 * date never change. One of `text`, `body`, `bodyMarkdown` or `options`
 * at least, and not both `body` and `bodyMarkdown`.
 */
export const LivePostEditSchema = Schema.Struct({
  body: Schema.optionalKey(RichTextSchema),
  bodyMarkdown: Schema.optionalKey(
    Schema.String.check(
      Schema.isMaxLength(maxBodyMarkdownLength),
      Schema.makeFilter(
        (text: string) => !text.includes("\u0000") && text.isWellFormed(),
        { expected: "text without NUL characters or unpaired surrogates" }
      )
    )
  ),
  options: Schema.optionalKey(TargetOptionsSchema),
  part: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  text: Schema.optionalKey(
    Schema.String.check(
      Schema.isNonEmpty(),
      Schema.isMaxLength(maxPostTextLength)
    )
  ),
})
  .check(
    Schema.makeFilter(
      ({
        body,
        bodyMarkdown,
        options,
        text,
      }: {
        readonly body?: unknown;
        readonly bodyMarkdown?: string;
        readonly options?: unknown;
        readonly text?: string;
      }) =>
        body !== undefined ||
        bodyMarkdown !== undefined ||
        options !== undefined ||
        text !== undefined,
      { expected: "a text, a body or options" }
    ),
    Schema.makeFilter(
      ({
        body,
        bodyMarkdown,
      }: {
        readonly body?: unknown;
        readonly bodyMarkdown?: string;
      }) => body === undefined || bodyMarkdown === undefined,
      { expected: "a body or a body as Markdown, not both" }
    )
  )
  .annotate({ identifier: "LivePostEdit" });

export type LivePostEdit = typeof LivePostEditSchema.Type;

/** A post's changes once live, newest first. */
export const LivePostChangesSchema = Schema.Struct({
  items: Schema.Array(LivePostChangeSchema),
}).annotate({ identifier: "LivePostChanges" });

export type LivePostChanges = typeof LivePostChangesSchema.Type;
