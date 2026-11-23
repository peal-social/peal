import { Schema } from "effect";

/** Testing a provider needs a model: the workspace writes no text with it and the catalogue suggests none. */
export class TestModelRequired extends Schema.TaggedError<TestModelRequired>()(
  "TestModelRequired",
  {}
) {}
