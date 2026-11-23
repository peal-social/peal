import { Schema } from "effect";

/**
 * An image call through the AI SDK gave no image, by the kind of failure
 * alone:
 *
 * - `status`: the provider answered its API's request with `status`, not
 *   a success.
 * - `unsent`: the request could not be sent or answered (the connection,
 *   the guard refusing the address, the fetch's own bound); `status` is
 *   null.
 * - `unusable`: the provider answered, but with nothing the SDK could
 *   read as an image, or what its answer pointed to could not be
 *   fetched; `status` is null.
 * - `refused`: the provider's package refused the request or its answer
 *   for another reason (a content rule, a model it does not take);
 *   `status` is null.
 *
 * It carries no cause: the SDK's error holds the request's body, with
 * the prompt, and the provider's words.
 */
export class ImageCallFailed extends Schema.TaggedError<ImageCallFailed>()(
  "ImageCallFailed",
  {
    kind: Schema.Literals(["status", "unsent", "unusable", "refused"]),
    status: Schema.NullOr(Schema.Int),
  }
) {
  override get message(): string {
    return `The image call gave no image: ${this.kind}`;
  }
}
