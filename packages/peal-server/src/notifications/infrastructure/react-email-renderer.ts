import { Effect, Layer } from "effect";
import {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
} from "peal-emails";

import { EmailRenderer } from "#notifications/application/email-renderer.ts";

/**
 * Writes emails with peal-emails, which the server loads as it starts: an
 * install without it, or one that cannot be loaded, stops the server there
 * rather than losing the first emails. Its types do not match the server's
 * while the server tells something the package has no words for, so this
 * file does not compile until it does.
 */
export const ReactEmailRenderer = Layer.succeed(
  EmailRenderer,
  EmailRenderer.of({
    account: (email) =>
      Effect.promise(async () => await renderAccountEmail(email)),
    notice: (email) =>
      Effect.promise(async () => await renderNoticeEmail(email)),
    weeklyDigest: (email) =>
      Effect.promise(async () => await renderWeeklyDigest(email)),
  })
);
