import { Effect, Layer } from "effect";

import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { renderAuthEmail } from "#notifications/domain/render-auth-email.ts";
import { renderNoticeEmail } from "#notifications/domain/render-notice-email.ts";
import { renderWeeklyDigest } from "#notifications/domain/weekly-digest.ts";

/** Writes emails with the context's own catalogues and layouts. */
export const CatalogueEmailRenderer = Layer.succeed(
  EmailRenderer,
  EmailRenderer.of({
    account: (email) => Effect.sync(() => renderAuthEmail(email)),
    notice: (email) => Effect.sync(() => renderNoticeEmail(email)),
    weeklyDigest: (email) => Effect.sync(() => renderWeeklyDigest(email)),
  })
);
