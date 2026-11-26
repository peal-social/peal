import { Effect } from "effect";

import { withoutChannels } from "#publishing/domain/post-content.ts";
import { isDropped } from "#publishing/domain/post-target.ts";
import { editDraft } from "#publishing/domain/post.ts";
import type { Post } from "#publishing/domain/post.ts";

import { PostRepository } from "./post-repository.ts";
import type { PostWithTargets } from "./post-repository.ts";
import { followOnSites } from "./site-holds.ts";

/**
 * Saves `draft`, the post `current` was, taken back to draft: by a member
 * (`unschedule`), by a reviewer (`HeldPosts.sendBack`), or by an approval
 * that came too late (`HeldPosts.release`). A draft is for the channels it
 * still goes to: a channel taken off the post (`dropped`) goes with its
 * target and every text and media its parts had there, so the draft
 * schedules as it is, and a channel chosen again starts afresh. The
 * websites follow it (`followOnSites`): a post a site holds is taken back
 * to a draft there, and one a dropped target left is taken off. Run in
 * the transaction that holds the post's lock.
 */
export const saveBackToDraft = Effect.fn("Publishing.saveBackToDraft")(
  function* saveBackToDraft(draft: Post, current: Post) {
    const posts = yield* PostRepository;
    const targets = yield* posts.lockTargets(draft.id);
    const dropped = targets.filter(isDropped);

    const gone = dropped.map(({ channelId }) => channelId);

    const cleaned =
      gone.length === 0
        ? draft
        : yield* Effect.fromResult(
            editDraft(draft, withoutChannels(draft.content, gone))
          ).pipe(Effect.orDie);

    if (!(yield* posts.update(cleaned, current))) {
      return yield* Effect.die("A post changed under its row lock");
    }

    // Before the dropped targets' rows go: their sites' posts are taken
    // off by the ids the jobs are started with.
    yield* followOnSites(cleaned, dropped);

    if (gone.length > 0) {
      yield* posts.setTargets(
        draft.id,
        targets.filter((target) => !isDropped(target))
      );
    }

    const saved: PostWithTargets = {
      post: cleaned,
      targets: yield* posts.targets(draft.id),
    };

    return saved;
  }
);
