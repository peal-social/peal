import { Schema } from "effect";

/** The provider a request names does not offer that use, as the catalogue says. */
export class CapabilityNotOffered extends Schema.TaggedError<CapabilityNotOffered>()(
  "CapabilityNotOffered",
  {}
) {}
