import { Schema } from "effect";

/** A voice was named for a provider whose model speaks with its own. */
export class VoiceNotOffered extends Schema.TaggedError<VoiceNotOffered>()(
  "VoiceNotOffered",
  {}
) {}
