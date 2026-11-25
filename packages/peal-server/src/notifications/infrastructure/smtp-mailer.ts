import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { createTransport } from "nodemailer";

import { MailDeliveryFailed } from "#notifications/application/mail-delivery-failed.ts";
import { Mailer } from "#notifications/application/mailer.ts";
import type { MailSenders } from "#notifications/infrastructure/mail-settings.ts";

// SMTP replies 5xx for what will fail again (an unknown address, a refused
// sender) and 4xx for what may pass later. An error without a reply code is
// the connection failing, which may pass too.
const SmtpReplySchema = Schema.Struct({
  command: Schema.optionalKey(Schema.String),
  response: Schema.optionalKey(Schema.String),
  responseCode: Schema.Number,
});

const decodeReply = Schema.decodeUnknownOption(SmtpReplySchema);

const isRetryable = (cause: unknown): boolean =>
  Option.match(decodeReply(cause), {
    onNone: () => true,
    onSome: ({ responseCode }) => responseCode < 500,
  });

// A reply's enhanced status code (RFC 3463), where it has one.
const enhancedCode = /^\d{3}[ -](?<code>5\.\d{1,3}\.\d{1,3})/u;

// Those about the recipient's address or mailbox: not the sender's address
// (5.1.7, 5.1.8) nor the server's policy (5.7.x, as "Relay access denied"),
// which servers also answer once the recipient is named.
const aboutRecipient = /^5\.(?:1\.(?:[0-6]|10)|2\.\d{1,3})$/u;

const refusedFor = (cause: unknown) =>
  Option.match(decodeReply(cause), {
    onNone: () => ({}),
    onSome: ({ command, response = "", responseCode }) => {
      const code = enhancedCode.exec(response)?.groups?.["code"];

      return command === "RCPT TO" &&
        responseCode >= 500 &&
        (code === undefined || aboutRecipient.test(code))
        ? { refusedFor: "recipient" as const }
        : {};
    },
  });

/**
 * Sends through an SMTP server. The connection is pooled and kept open
 * between emails: some servers take seconds to greet a new connection.
 */
export const smtpMailer = (options: {
  readonly senders: MailSenders;
  readonly url: Redacted.Redacted;
}) =>
  Layer.effect(
    Mailer,
    Effect.gen(function* makeSmtpMailer() {
      const transport = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createTransport({ pool: true, url: Redacted.value(options.url) })
        ),
        (opened) =>
          Effect.sync(() => {
            opened.close();
          })
      );

      return Mailer.of({
        send: (message) =>
          Effect.tryPromise({
            catch: (cause) =>
              new MailDeliveryFailed({
                cause,
                retryable: isRetryable(cause),
                ...refusedFor(cause),
              }),
            try: async () =>
              await transport.sendMail({
                from: options.senders[message.sender ?? "automatic"],
                headers: { ...message.headers },
                html: message.html,
                subject: message.subject,
                text: message.text,
                to: message.to,
              }),
          }).pipe(Effect.asVoid, Effect.withSpan("Mailer.smtp")),
      });
    })
  );
