import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The workspace composes no slide video: it chose no service for
 * `composition` (`notSet`), or the key of the one it chose can no longer
 * be read (`keyUnreadable`) and must be typed again.
 */
export class CompositionUnavailable extends Schema.TaggedError<CompositionUnavailable>()(
  "CompositionUnavailable",
  {
    ...errorEnvelope,
    reason: Schema.Literals(["notSet", "keyUnreadable"]),
  },
  {
    description:
      "The workspace composes no slide video: no service is chosen for it (`notSet`: connect Shotstack with `PUT .../assistant/providers/shotstack`, then choose it with `PUT .../assistant/models/composition`), or the chosen service's key can no longer be read (`keyUnreadable`: connect it again with its key). Nothing was asked or counted.",
    httpApiStatus: 409,
  }
) {}
