import { Schema } from "effect";

/** The workspace's media library has no file with this id. */
export class AudioMediaNotFound extends Schema.TaggedError<AudioMediaNotFound>()(
  "AudioMediaNotFound",
  {}
) {}
