import { assert, describe, layer } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";

import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { digestWeekOf } from "#notifications/domain/weekly-digest.ts";
import { ReactEmailRenderer } from "#notifications/infrastructure/react-email-renderer.ts";
import { PostIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

const workspaceId = WorkspaceIdSchema.make(
  "2f9a3c1e-7d4b-4e8f-9a1c-3b5d7e9f1a2c"
);

describe("the emails' renderer", () => {
  layer(ReactEmailRenderer)((it) => {
    it.effect("writes an account email in its reader's language", () =>
      Effect.gen(function* account() {
        const renderer = yield* EmailRenderer;
        const url = "https://app.example.test/api/auth/verify-email?token=abc";

        const { html, subject, text } = yield* renderer.account({
          _tag: "VerifyEmail",
          locale: "fr",
          to: "ada@example.test",
          url,
        });

        assert.strictEqual(subject, "Confirmez votre adresse e-mail pour Peal");
        assert.include(text, `Confirmer mon adresse : ${url}`);
        assert.include(html, `href="${url}"`);
        assert.match(html, /<html [^>]*lang="fr"/u);
      })
    );

    it.effect("writes a notice, without a name a mail client would link", () =>
      Effect.gen(function* notice() {
        const renderer = yield* EmailRenderer;

        const { html, text } = yield* renderer.notice({
          event: {
            _tag: "PostUnconfirmed",
            channel: Option.some({ handle: "@a<b>", platform: "x" }),
            postId: PostIdSchema.make("00000000-0000-7000-8000-000000000001"),
          },
          locale: "en",
          url: "https://app.example.test/app/0b1c/posts/0190",
          workspaceName: "studio.example",
        });

        assert.include(text, "a workspace");
        assert.notInclude(`${html}${text}`, "studio.example");
        assert.include(html, "X (@a&lt;b&gt;)");
      })
    );

    it.effect("writes the weekly digest", () =>
      Effect.gen(function* digest() {
        const renderer = yield* EmailRenderer;
        const calendarUrl = `https://app.example.test/${workspaceId}/calendar`;

        const { html, subject, text } = yield* renderer.weeklyDigest({
          calendarUrl,
          locale: "en",
          preferencesUrl: `https://app.example.test/${workspaceId}/settings/notifications`,
          week: digestWeekOf(DateTime.makeUnsafe("2026-11-16T06:23:00Z")),
          workspaces: [
            {
              calendarUrl,
              counts: {
                awaitingApproval: 0,
                failed: 0,
                scheduled: 2,
                unconfirmed: 0,
                wentOut: 3,
              },
              engagement: Option.none(),
              name: "Studio Nord",
              planned: [],
              wentOut: [
                {
                  at: DateTime.makeUnsafe("2026-11-10T09:00:00Z"),
                  excerpt: "Hello",
                },
              ],
              workspaceId,
            },
          ],
        });

        assert.strictEqual(
          subject,
          "Your week on Peal: November 9, 2026 to November 15, 2026"
        );

        for (const part of [html, text]) {
          assert.include(part, "Studio Nord");
          assert.include(part, "November 10, 2026 at 9:00 AM UTC: Hello");
          assert.include(part, calendarUrl);
        }
      })
    );
  });
});
