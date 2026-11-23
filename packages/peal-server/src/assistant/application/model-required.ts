import { Schema } from "effect";

/** Choosing a provider for a use that takes a model, without one. */
export class ModelRequired extends Schema.TaggedError<ModelRequired>()(
  "ModelRequired",
  {}
) {}
