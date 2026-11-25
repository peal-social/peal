import { Context } from "effect";
import type { Effect } from "effect";

import type { AuthEmail } from "#notifications/domain/auth-email.ts";
import type { NoticeEvent } from "#notifications/domain/notice-event.ts";
import type { DigestEmail } from "#notifications/domain/weekly-digest.ts";
import type { Locale } from "#shared/domain/locale.ts";

/** An email ready to send: its subject, and the same words as HTML and text. */
export interface RenderedEmail {
  readonly html: string;
  readonly subject: string;
  readonly text: string;
}

/** A notice for one reader, as an email. */
export interface NoticeEmail {
  readonly event: NoticeEvent;
  readonly locale: Locale;
  /** The page the email links to, in the reader's language. */
  readonly url: string;
  readonly workspaceName: string;
}

/** The welcome of a new account, as an email a person signs. */
export interface WelcomeEmail {
  readonly locale: Locale;
  /** Who signs it. */
  readonly signer: string;
  /** The page it opens, in the reader's language. */
  readonly url: string;
}

/**
 * Writes each email in its reader's language. It never fails: an email that
 * cannot be written is a bug.
 */
export class EmailRenderer extends Context.Service<
  EmailRenderer,
  {
    readonly account: (email: AuthEmail) => Effect.Effect<RenderedEmail>;
    readonly notice: (email: NoticeEmail) => Effect.Effect<RenderedEmail>;
    readonly weeklyDigest: (email: DigestEmail) => Effect.Effect<RenderedEmail>;
    readonly welcome: (email: WelcomeEmail) => Effect.Effect<RenderedEmail>;
  }
>()("peal-server/notifications/application/EmailRenderer") {}
