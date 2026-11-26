import { Context, Effect, Layer, Option } from "effect";

import type { LivePostChangeId } from "#publishing/domain/live-post-change-id.ts";
import { withEditOn } from "#publishing/domain/live-post-edit.ts";
import type { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import { partsOn } from "#publishing/domain/post-content.ts";
import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

import { LivePostChangeStore } from "./live-post-change-store.ts";
import { PostRepository } from "./post-repository.ts";

/**
 * What a website's edit sends beside its text: the target it keeps its
 * files by, its workspace, and its rich text once edited (none: the
 * site gets the text and the media written as one).
 */
export interface PendingSiteEdit {
  readonly body: Option.Option<ArticleBody>;
  readonly targetId: PostTargetId;
  readonly workspaceId: WorkspaceId;
}

/**
 * What an edit sends: its new text, the target's options there (a
 * website's new ones, when the edit gives some), and the part's media on
 * the channel, as the edit leaves them. `site` is what a website's
 * editor needs besides; every other editor reads none of it.
 */
export interface PendingEdit {
  readonly media: readonly MediaAttachment[];
  readonly options: Option.Option<TargetOptions>;
  readonly site?: PendingSiteEdit;
  readonly text: string;
}

/**
 * What the gate's side of an edit reads, as the call that reaches it
 * holds ids only: the text of the pending edit, the options of its
 * target, which some platforms must be sent again (Mastodon's content
 * warning), and the media of its part on the channel (Slack's images),
 * read from the post as the edit leaves it (`withEditOn`): a website's
 * rich text and its images, its new options. None once the change ended
 * or went with its workspace.
 */
export class LivePostEdits extends Context.Service<
  LivePostEdits,
  {
    readonly of: (
      changeId: LivePostChangeId
    ) => Effect.Effect<Option.Option<PendingEdit>, DatabaseError>;
  }
>()("peal-server/publishing/application/LivePostEdits") {
  /** From the changes' and the posts' stores. */
  static readonly layer = Layer.effect(
    LivePostEdits,
    Effect.gen(function* LivePostEditsLive() {
      const changes = yield* LivePostChangeStore;
      const posts = yield* PostRepository;

      return LivePostEdits.of({
        of: Effect.fn("LivePostEdits.of")(function* of(
          changeId: LivePostChangeId
        ) {
          const change = yield* changes.find(changeId);

          if (
            Option.isNone(change) ||
            change.value.status !== "pending" ||
            change.value.kind !== "edit" ||
            Option.isNone(change.value.text)
          ) {
            return Option.none<PendingEdit>();
          }

          const { body, channelId, partsLeft, postId, targetId, workspaceId } =
            change.value;

          const text = change.value.text.value;
          const target = yield* posts.findTarget(targetId);
          const stored = yield* posts.find(postId);
          const index = partsLeft[0]?.index ?? 0;

          // The post as the edit leaves it on the channel.
          const edited = stored.pipe(
            Option.map(({ post }) =>
              withEditOn(post.content, index, channelId, { body, text })
            )
          );

          // The part's media as it goes out on the channel.
          const media = edited.pipe(
            Option.flatMap((content) =>
              Option.fromUndefinedOr(
                partsOn(content, channelId).find((part) => part.index === index)
              )
            ),
            Option.map((part) => part.media),
            Option.getOrElse((): readonly MediaAttachment[] => [])
          );

          // A website's rich text, its first part's alone.
          const rich = edited.pipe(
            Option.filter(() => index === 0),
            Option.flatMap((content) =>
              Option.fromUndefinedOr(
                content.overrides.find(
                  (override) => override.channelId === channelId
                )?.body
              )
            )
          );

          return target.pipe(
            Option.map((found): PendingEdit => ({
              media,
              options: Option.orElse(change.value.options, () => found.options),
              site: { body: rich, targetId, workspaceId },
              text,
            }))
          );
        }),
      });
    })
  );
}
