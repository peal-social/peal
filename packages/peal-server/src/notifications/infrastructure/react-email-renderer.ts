import { Effect, Layer, Option } from "effect";
import {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
} from "peal-emails";
import type { Letterhead } from "peal-emails";

import { AppLinks } from "#notifications/application/app-links.ts";
import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { mailIdentityConfig } from "#notifications/infrastructure/mail-settings.ts";

/**
 * Writes emails with peal-emails, which the server loads as it starts: an
 * install without it, or one that cannot be loaded, stops the server there
 * rather than losing the first emails. Its types do not match the server's
 * while the server tells something the package has no words for, so this
 * file does not compile until it does.
 *
 * Every email carries the server's letterhead: where it serves their
 * pictures (`#app/email-assets/route.ts`), and who sends, where
 * `PEAL_MAIL_IDENTITY` states it.
 */
export const ReactEmailRenderer = Layer.effect(
  EmailRenderer,
  Effect.gen(function* ReactEmailRenderer() {
    const links = yield* AppLinks;

    const letterhead: Letterhead = {
      assetsUrl: links.api("/api/email-assets"),
      identity: Option.getOrNull(yield* mailIdentityConfig),
    };

    return EmailRenderer.of({
      account: (email) =>
        Effect.promise(async () => await renderAccountEmail(email, letterhead)),
      notice: (email) =>
        Effect.promise(async () => await renderNoticeEmail(email, letterhead)),
      weeklyDigest: (email) =>
        Effect.promise(async () => await renderWeeklyDigest(email, letterhead)),
    });
  })
);
