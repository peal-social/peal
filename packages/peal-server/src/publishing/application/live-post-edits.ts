import { Context, Effect, Layer, Option } from "effect";

import type { LivePostChangeId } from "#publishing/domain/live-post-change-id.ts";
import type { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import { partsOn } from "#publishing/domain/post-content.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";

import { LivePostChangeStore } from "./live-post-change-store.ts";
import { PostRepository } from "./post-repository.ts";

/**
 * What an edit sends: its new text, the target's options there, and the
 * part's media on the channel.
 */
export interface PendingEdit {
  readonly media: readonly MediaAttachment[];
  readonly options: Option.Option<TargetOptions>;
  readonly text: string;
}

/**
 * What the gate's side of an edit reads, as the call that reaches it
 * holds ids only: the text of the pending edit, the options of its
 * target, which some platforms must be sent again (Mastodon's content
 * warning), and the media of its part on the channel (Slack's images). None once the change ended or went with its workspace.
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

          const { channelId, partsLeft, postId, targetId } = change.value;
          const text = change.value.text.value;
          const target = yield* posts.findTarget(targetId);
          const stored = yield* posts.find(postId);
          const [edited] = partsLeft;

          // The part's media as it went out on the channel.
          const media = stored.pipe(
            Option.flatMap(({ post }) =>
              Option.fromUndefinedOr(
                partsOn(post.content, channelId).find(
                  ({ index }) => index === edited?.index
                )
              )
            ),
            Option.map((part) => part.media),
            Option.getOrElse((): readonly MediaAttachment[] => [])
          );

          return target.pipe(
            Option.map(({ options }): PendingEdit => ({ media, options, text }))
          );
        }),
      });
    })
  );
}
