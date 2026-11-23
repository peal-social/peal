import { Schema } from "effect";

/**
 * Slide videos are for paying customers: on a server that bills, the
 * workspace's billing account has no payment method.
 */
export class CompositionNeedsPayment extends Schema.TaggedError<CompositionNeedsPayment>()(
  "CompositionNeedsPayment",
  {}
) {}
