import { Context } from "effect";
import type { Effect } from "effect";

import type { MailSender } from "#notifications/domain/mail-sender.ts";

import type { MailDeliveryFailed } from "./mail-delivery-failed.ts";

/** One email to one address, rendered, as a mail transport takes it. */
export interface EmailMessage {
  /**
   * Headers of its own, such as the weekly digest's `List-Unsubscribe`;
   * none for most.
   */
  readonly headers?: Readonly<Record<string, string>>;
  readonly html: string;
  /**
   * The same for every attempt at sending one email, so a transport that
   * deduplicates (Resend keeps keys for a day) sends it once.
   */
  readonly idempotencyKey: string;
  /** Whose address it leaves from: the server's when not said. */
  readonly sender?: MailSender;
  readonly subject: string;
  readonly text: string;
  readonly to: string;
}

/**
 * Sends each email from its sender's address: through Resend's API, or any
 * SMTP server (Mailpit in development).
 */
export class Mailer extends Context.Service<
  Mailer,
  {
    readonly send: (
      message: EmailMessage
    ) => Effect.Effect<void, MailDeliveryFailed>;
  }
>()("peal-server/notifications/application/Mailer") {}
