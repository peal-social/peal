import { Effect, Layer, Option } from "effect";
import {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
  renderWelcomeEmail,
} from "peal-emails";
import type { Letterhead } from "peal-emails";

import { AppLinks } from "#notifications/application/app-links.ts";
import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { mailIdentityConfig } from "#notifications/infrastructure/mail-settings.ts";
import type { Locale } from "#shared/domain/locale.ts";

/**
 * Writes emails with peal-emails, which the server loads as it starts: an
 * install without it, or one that cannot be loaded, stops the server there
 * rather than losing the first emails. Its types do not match the server's
 * while the server tells something the package has no words for, so this
 * file does not compile until it does.
 *
 * Every email carries the server's letterhead: where it serves their
 * pictures (`#app/email-assets/route.ts`), and who sends, in the reader's
 * language, where `PEAL_MAIL_IDENTITY` and `PEAL_MAIL_IDENTITY_FR` state it.
 */
export const ReactEmailRenderer = Layer.effect(
  EmailRenderer,
  Effect.gen(function* ReactEmailRenderer() {
    const links = yield* AppLinks;

    const identity = yield* mailIdentityConfig;

    const letterheadIn = (locale: Locale): Letterhead => ({
      assetsUrl: links.api("/api/email-assets"),
      identity: Option.getOrNull(identity[locale]),
    });

    return EmailRenderer.of({
      account: (email) =>
        Effect.promise(
          async () =>
            await renderAccountEmail(email, letterheadIn(email.locale))
        ),
      notice: (email) =>
        Effect.promise(
          async () => await renderNoticeEmail(email, letterheadIn(email.locale))
        ),
      weeklyDigest: (email) =>
        Effect.promise(
          async () =>
            await renderWeeklyDigest(email, letterheadIn(email.locale))
        ),
      welcome: (email) =>
        Effect.promise(
          async () =>
            await renderWelcomeEmail(email, letterheadIn(email.locale))
        ),
    });
  })
);
