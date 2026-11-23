import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Slide videos are for workspaces whose billing account pays: this one has
 * no payment method (the free tier, or a trial without one). Only a server
 * that bills answers it.
 */
export class CompositionNeedsPayment extends Schema.TaggedError<CompositionNeedsPayment>()(
  "CompositionNeedsPayment",
  {
    ...errorEnvelope,
    // The billing page of the workspace, where an owner or an admin adds a
    // payment method.
    billingUrl: Schema.String,
  },
  {
    description:
      "Slide videos need a payment method on the workspace's billing account: an owner or an admin adds one on the billing page (`billingUrl`). Peal bills nothing for them, as the workspace's own Shotstack account pays for each render. Nothing was asked or counted. A server that does not bill never answers it.",
    httpApiStatus: 402,
  }
) {}
