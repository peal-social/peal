import { Schema } from "effect";

/** The workspace has not connected the provider a request names. */
export class ProviderNotConnected extends Schema.TaggedError<ProviderNotConnected>()(
  "ProviderNotConnected",
  {}
) {}
