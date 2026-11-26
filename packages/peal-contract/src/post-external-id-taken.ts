import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** Another post of the workspace has this external id. */
export class PostExternalIdTaken extends Schema.TaggedError<PostExternalIdTaken>()(
  "PostExternalIdTaken",
  {
    ...errorEnvelope,
    // The post that has it; null when it is an earlier row of the same
    // file, which is no post yet: `message` names the row.
    postId: Schema.NullOr(Schema.String),
  },
  {
    description:
      "Another post of the workspace that is not cancelled has this `externalId`: `postId` is that post. Nothing was made or changed. An external id is unique in a workspace among posts that are not cancelled, so a creation sent again, however long after, never makes a second post: read the post `postId` names (`GET …/posts/{postId}`), or find it with `GET …/posts?externalId=`.",
    httpApiStatus: 409,
  }
) {}
