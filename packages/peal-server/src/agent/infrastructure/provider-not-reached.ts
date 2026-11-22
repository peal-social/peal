import { Schema } from "effect";

/**
 * The workspace's own text provider was not asked: the outbound guard
 * refused its address (`providerRefused`), or its name could not be looked
 * up for now (`unreachable`).
 */
export class ProviderNotReached extends Schema.TaggedError<ProviderNotReached>()(
  "ProviderNotReached",
  { reason: Schema.Literals(["providerRefused", "unreachable"]) }
) {}
