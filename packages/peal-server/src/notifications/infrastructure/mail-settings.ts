import { Config, Option, Redacted, Schema } from "effect";

import type { MailSender } from "#notifications/domain/mail-sender.ts";
import type { Locale } from "#shared/domain/locale.ts";
import { requiredInProduction } from "#shared/infrastructure/environment.ts";

/** How email leaves Peal: Resend's API, or an SMTP server. */
export type MailTransport =
  | { readonly _tag: "Resend"; readonly apiKey: Redacted.Redacted }
  | { readonly _tag: "Smtp"; readonly url: Redacted.Redacted };

// SMTP_URL may hold a password, so it is redacted like a key. Outside
// production it defaults to Mailpit from the development stack.
const smtp = requiredInProduction(
  Config.Redacted("SMTP_URL"),
  Redacted.make("smtp://127.0.0.1:11025")
).pipe(Config.map((url): MailTransport => ({ _tag: "Smtp", url })));

const transport = Config.option(Config.Redacted("RESEND_API_KEY")).pipe(
  Config.flatMap(
    Option.match({
      onNone: () => smtp,
      onSome: (apiKey) =>
        Config.succeed<MailTransport>({ _tag: "Resend", apiKey }),
    })
  )
);

/** The address each sender's emails leave from. */
export type MailSenders = Readonly<Record<MailSender, string>>;

const personalFrom = Config.option(
  Config.String("PEAL_MAIL_PERSONAL_FROM").pipe(
    Config.map((from) => from.trim())
  )
).pipe(Config.map(Option.filter((from) => from !== "")));

const senders = Config.all({
  automatic: requiredInProduction(
    Config.NonEmptyString("MAIL_FROM"),
    "Peal <noreply@peal.localhost>"
  ),
  personal: personalFrom,
}).pipe(
  Config.map(({ automatic, personal }): MailSenders => ({
    automatic,
    personal: Option.getOrElse(personal, () => automatic),
  }))
);

/**
 * The mail settings, read from the environment:
 *
 * - `RESEND_API_KEY` sends through Resend; otherwise `SMTP_URL` sends through
 *   that server (`smtp://user:password@host:587`, or `smtps://` for TLS).
 * - `MAIL_FROM` is the sender, as `Name <address>` or an address the
 *   transport may send from.
 * - `PEAL_MAIL_PERSONAL_FROM`, written the same way, is the sender of the
 *   emails a person signs. Unset or empty, they leave from `MAIL_FROM`.
 *
 * Production needs MAIL_FROM and a transport: without them nobody could
 * confirm an email address or reset a password.
 */
export const mailSettingsConfig = Config.all({
  senders,
  transport,
});

/** The most characters the line that says who sends may hold. */
export const maxIdentityLength = 300;

/** The most characters the name that signs the welcome may hold. */
export const maxSignerLength = 60;

// One line: no line break, nor any other control character. None when unset
// or empty.
const oneLine = (name: string, maxLength: number) =>
  Config.schema(
    Schema.Trim.check(
      Schema.isPattern(
        new RegExp(String.raw`^[^\p{Cc}\u2028\u2029]{0,${maxLength}}$`, "u"),
        { expected: `one line of at most ${maxLength} characters` }
      )
    ),
    name
  ).pipe(Config.option, Config.map(Option.filter((line) => line !== "")));

/** Who sends, as the operator states it to the readers of each language. */
export type MailIdentity = Readonly<Record<Locale, Option.Option<string>>>;

/**
 * Who sends the emails, as the operator states it under each, on one line:
 *
 * - `PEAL_MAIL_IDENTITY` for every reader; none when unset or empty.
 * - `PEAL_MAIL_IDENTITY_FR` for French readers, who otherwise get that line.
 *   A later language adds its own, the same name with its code.
 *
 * Read when the server starts, so a value that is not one line stops it
 * there.
 */
export const mailIdentityConfig = Config.all({
  everyone: oneLine("PEAL_MAIL_IDENTITY", maxIdentityLength),
  french: oneLine("PEAL_MAIL_IDENTITY_FR", maxIdentityLength),
}).pipe(
  Config.map(({ everyone, french }): MailIdentity => ({
    en: everyone,
    fr: Option.orElse(french, () => everyone),
  }))
);

/**
 * `PEAL_MAIL_WELCOME_SIGNER`: the name that signs the welcome, which is sent
 * only where it is set. Read when the server starts, so a value that is not
 * one line stops it there.
 */
export const mailWelcomeSignerConfig = oneLine(
  "PEAL_MAIL_WELCOME_SIGNER",
  maxSignerLength
);

export type MailSettings = Config.Success<typeof mailSettingsConfig>;
