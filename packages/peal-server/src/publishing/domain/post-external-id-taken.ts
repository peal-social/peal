import { Schema } from "effect";

import { PostIdSchema } from "#shared/domain/ids.ts";

/**
 * Another post of the workspace that is not cancelled has this external id:
 * `postId` is that post, none when it is one a batch has not made yet (an
 * earlier row of the same file). Nothing was made or changed.
 */
export class PostExternalIdTaken extends Schema.TaggedError<PostExternalIdTaken>()(
  "PostExternalIdTaken",
  { postId: Schema.Option(PostIdSchema) }
) {
  override get message(): string {
    return "Another post of the workspace has this external id";
  }
}
