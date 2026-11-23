import { Schema } from "effect";

/** Connecting a provider needs its key: the workspace has none stored for it that opens, or the new address is not the one the stored key was typed for, and a key is never sent to another address. */
export class ProviderKeyRequired extends Schema.TaggedError<ProviderKeyRequired>()(
  "ProviderKeyRequired",
  {}
) {}
