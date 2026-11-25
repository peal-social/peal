import { Schema } from "effect";

/** The mail transport did not accept an email. */
export class MailDeliveryFailed extends Schema.TaggedError<MailDeliveryFailed>()(
  "MailDeliveryFailed",
  {
    cause: Schema.Defect(),
    // Why no later try may send it, where one is known: its recipient's
    // address was refused, or the transport holds another email under its
    // key, which may have gone out. Without it, a refusal is the sender's, the
    // account's or the message's, which the operator may put right.
    refusedFor: Schema.optionalKey(Schema.Literals(["duplicate", "recipient"])),
    // Whether sending it again may work: a refused connection may, a refused
    // address will not.
    retryable: Schema.Boolean,
  }
) {}
