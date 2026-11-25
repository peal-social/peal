import { Effect, Layer } from "effect";

import { EmailRenderer } from "#notifications/application/email-renderer.ts";

// Loaded with the first email: React Email, with the components and parsers
// its one entry brings, takes longer to load than the server should wait to
// start.
const emails = async () => await import("peal-emails");

/**
 * Writes emails with peal-emails. Its types do not match the server's while
 * the server tells something the package has no words for, so this file
 * does not compile until it does.
 */
export const ReactEmailRenderer = Layer.succeed(
  EmailRenderer,
  EmailRenderer.of({
    account: (email) =>
      Effect.promise(async () => {
        const { renderAccountEmail } = await emails();

        return await renderAccountEmail(email);
      }),
    notice: (email) =>
      Effect.promise(async () => {
        const { renderNoticeEmail } = await emails();

        return await renderNoticeEmail(email);
      }),
    weeklyDigest: (email) =>
      Effect.promise(async () => {
        const { renderWeeklyDigest } = await emails();

        return await renderWeeklyDigest(email);
      }),
  })
);
