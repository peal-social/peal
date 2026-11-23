import { Schema } from "effect";

/**
 * The asset's bytes are not handed out for this use: it is not of a kind
 * the use takes (`wrongKind`), not ready yet (`notReady`), or larger than
 * the use takes (`tooLarge`).
 */
export class MediaNotReadable extends Schema.TaggedError<MediaNotReadable>()(
  "MediaNotReadable",
  { reason: Schema.Literals(["wrongKind", "notReady", "tooLarge"]) }
) {}
