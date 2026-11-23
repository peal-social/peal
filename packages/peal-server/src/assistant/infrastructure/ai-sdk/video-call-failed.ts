import { Schema } from "effect";

/**
 * A video call through the AI SDK gave no video, by the kind of failure
 * alone:
 *
 * - `status`: the provider answered a request of its API (the start or a
 *   poll) with `status`, not a success.
 * - `unsent`: a request could not be sent or answered (the connection,
 *   the guard refusing the address, the fetch's own bound); `status` is
 *   null.
 * - `unusable`: the provider answered, but with nothing the SDK could
 *   read as a video, or the video it pointed to could not be fetched
 *   (refused, too large); `status` is null.
 * - `refused`: the provider said the operation failed (its content rules,
 *   a setting the model does not take), or its package refused the
 *   request; `status` is null.
 *
 * It carries no cause: the SDK's error holds the request's body, with
 * the prompt, the provider's words and the video's address, which may
 * carry the key.
 */
export class VideoCallFailed extends Schema.TaggedError<VideoCallFailed>()(
  "VideoCallFailed",
  {
    kind: Schema.Literals(["status", "unsent", "unusable", "refused"]),
    status: Schema.NullOr(Schema.Int),
  }
) {
  override get message(): string {
    return `The video call gave no video: ${this.kind}`;
  }
}
