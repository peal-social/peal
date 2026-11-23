import { Schema } from "effect";

/**
 * A speech or transcription call through the AI SDK gave no audio or no
 * transcript, by the kind of failure alone:
 *
 * - `status`: the provider answered a request of its API with `status`,
 *   not a success.
 * - `unsent`: a request could not be sent or answered (the connection,
 *   the guard refusing the address, the fetch's own bound); `status` is
 *   null.
 * - `unusable`: the provider answered, but with nothing the SDK could
 *   read as audio or a transcript, or the audio it pointed to could not
 *   be fetched; `status` is null.
 * - `refused`: the provider's package refused the request or its answer
 *   for another reason; `status` is null.
 *
 * It carries no cause: the SDK's error holds the request's body, with
 * the text or the audio, and the provider's words.
 */
export class AudioCallFailed extends Schema.TaggedError<AudioCallFailed>()(
  "AudioCallFailed",
  {
    kind: Schema.Literals(["status", "unsent", "unusable", "refused"]),
    status: Schema.NullOr(Schema.Int),
  }
) {
  override get message(): string {
    return `The audio call gave nothing: ${this.kind}`;
  }
}
