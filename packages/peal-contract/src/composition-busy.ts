import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace has a slide video on the way already: one at a time. */
export class CompositionBusy extends Schema.TaggedError<CompositionBusy>()(
  "CompositionBusy",
  {
    ...errorEnvelope,
    // The slide video on the way, to follow with `GET .../media/slideshows/{id}`.
    slideshowId: Schema.String,
  },
  {
    description:
      "The workspace already has a slide video queued or being composed (`slideshowId`): one is composed at a time. Nothing was asked or counted; ask again once it has ended.",
    httpApiStatus: 429,
  }
) {}
