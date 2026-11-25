import { Context, Effect, Layer, Option } from "effect";

import { welcomeKeyOf } from "#notifications/domain/welcome.ts";
import type { WelcomeOutcome } from "#notifications/domain/welcome.ts";
import type { UserId } from "#shared/domain/ids.ts";

import { AppLinks } from "./app-links.ts";
import { EmailRenderer } from "./email-renderer.ts";
import type { MailDeliveryFailed } from "./mail-delivery-failed.ts";
import { Mailer } from "./mailer.ts";
import type { RecipientsUnavailable } from "./recipients-unavailable.ts";
import { WelcomeReaders } from "./welcome-readers.ts";
import { WelcomeSigner } from "./welcome-signer.ts";

// A refusal sent nothing, so it waits for the next check, when what it was
// about (the sender, the account) may have been put right: unless it is the
// recipient's, or another email went out under its key.
const settled = ({ cause, refusedFor, retryable }: MailDeliveryFailed) => {
  if (refusedFor !== undefined) {
    return Effect.logError("A welcome was refused", cause).pipe(
      Effect.annotateLogs({ refusedFor }),
      Effect.as<WelcomeOutcome>("skip")
    );
  }

  const message = "A welcome was refused, and waits for its next check";

  return (
    retryable
      ? Effect.logWarning(message, cause)
      : Effect.logError(message, cause)
  ).pipe(Effect.as<WelcomeOutcome>("wait"));
};

/**
 * Sends a new account's welcome, from the address of the person who signs
 * it, in the account's language. Only to an address its person confirmed:
 * someone may have signed up with another person's.
 */
export class SendWelcomeEmail extends Context.Service<
  SendWelcomeEmail,
  {
    /** Checks the account now, and sends the welcome if it is time to. */
    readonly deliver: (
      userId: UserId
    ) => Effect.Effect<WelcomeOutcome, RecipientsUnavailable>;
  }
>()("peal-server/notifications/application/SendWelcomeEmail") {
  static readonly layer = Layer.effect(
    SendWelcomeEmail,
    Effect.gen(function* SendWelcomeEmailLive() {
      const links = yield* AppLinks;
      const mailer = yield* Mailer;
      const readers = yield* WelcomeReaders;
      const renderer = yield* EmailRenderer;
      const signer = yield* WelcomeSigner;

      const deliver = Effect.fn("SendWelcomeEmail.deliver")(function* deliver(
        userId: UserId
      ): Effect.fn.Return<WelcomeOutcome, RecipientsUnavailable> {
        // Turned off since the account was made.
        if (Option.isNone(signer.name)) {
          return "skip";
        }

        const found = yield* readers.readerOf(userId);

        if (Option.isNone(found)) {
          return "skip";
        }

        const { email, emailConfirmed, locale } = found.value;

        if (!emailConfirmed) {
          return "wait";
        }

        const rendered = yield* renderer.welcome({
          locale,
          signer: signer.name.value,
          url: links.url("/", locale),
        });

        return yield* mailer
          .send({
            ...rendered,
            // The same at every check, so a transport that deduplicates
            // sends it once.
            idempotencyKey: welcomeKeyOf(userId),
            sender: "personal",
            to: email,
          })
          .pipe(
            Effect.as<WelcomeOutcome>("sent"),
            Effect.catchTag("MailDeliveryFailed", settled),
            Effect.annotateLogs({ userId })
          );
      });

      return SendWelcomeEmail.of({ deliver });
    })
  );
}
