import { assert, describe, layer } from "@effect/vitest";
import { ConfigProvider, DateTime, Effect, Layer, Option } from "effect";

import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { digestWeekOf } from "#notifications/domain/weekly-digest.ts";
import { PublicAppLinks } from "#notifications/infrastructure/public-app-links.ts";
import { ReactEmailRenderer } from "#notifications/infrastructure/react-email-renderer.ts";
import { PostIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

const workspaceId = WorkspaceIdSchema.make(
  "2f9a3c1e-7d4b-4e8f-9a1c-3b5d7e9f1a2c"
);

// The renderer of a server with these settings.
const rendererOf = (settings: Readonly<Record<string, string>>) =>
  ReactEmailRenderer.pipe(
    Layer.provide(PublicAppLinks),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(settings)))
  );

const verifyEmail = {
  _tag: "VerifyEmail",
  locale: "en",
  to: "ada@example.test",
  url: "https://app.example.test/api/auth/verify-email?token=abc",
} as const;

const identity = "Synthetic Studio <SAS> & Co";

const frenchIdentity = "Synthetic Studio. Siège social : 1 Example St";

describe("the emails' renderer", () => {
  layer(
    rendererOf({
      PEAL_MAIL_IDENTITY: identity,
      PUBLIC_URL: "https://peal.example.test",
    })
  )((it) => {
    it.effect("names the pictures this server serves, and who sends", () =>
      Effect.gen(function* stated() {
        const { html, text } = yield* EmailRenderer.use((renderer) =>
          renderer.account(verifyEmail)
        );

        for (const name of ["mark.png", "header.gif", "footer.png"]) {
          assert.include(
            html,
            `src="https://peal.example.test/api/email-assets/${name}"`
          );
        }

        assert.include(html, "Synthetic Studio &lt;SAS&gt; &amp; Co");
        assert.isTrue(text.endsWith(`The Peal team\n\n${identity}`));
      })
    );
  });

  layer(
    rendererOf({
      PEAL_MAIL_IDENTITY: identity,
      PEAL_MAIL_IDENTITY_FR: frenchIdentity,
      PUBLIC_URL: "https://peal.example.test",
    })
  )((it) => {
    it.effect.each([
      { closing: `The Peal team\n\n${identity}`, locale: "en" as const },
      { closing: `L’équipe Peal\n\n${frenchIdentity}`, locale: "fr" as const },
    ])("says who sends in the reader's language: $locale", (sample) =>
      Effect.gen(function* inTheirs() {
        const { closing, locale } = sample;

        const { html, text } = yield* EmailRenderer.use((renderer) =>
          renderer.account({ ...verifyEmail, locale })
        );

        assert.isTrue(text.endsWith(closing));
        assert.strictEqual(html.includes("Siège social"), locale === "fr");
        assert.strictEqual(
          html.includes("&lt;SAS&gt; &amp; Co"),
          locale === "en"
        );
      })
    );
  });

  layer(rendererOf({}))((it) => {
    it.effect("states nobody on a server that does not", () =>
      Effect.gen(function* unstated() {
        const { html, text } = yield* EmailRenderer.use((renderer) =>
          renderer.account(verifyEmail)
        );

        assert.include(
          html,
          'src="http://localhost:3001/api/email-assets/mark.png"'
        );
        assert.notInclude(html, "Synthetic Studio");
        assert.isTrue(text.endsWith("The Peal team"));
      })
    );

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

    it.effect("writes the welcome, signed by who the server names", () =>
      Effect.gen(function* welcome() {
        const { html, subject, text } = yield* EmailRenderer.use((renderer) =>
          renderer.welcome({
            locale: "fr",
            signer: "Camille Synthetic",
            url: "https://app.example.test/fr/",
          })
        );

        assert.strictEqual(subject, "Bienvenue sur Peal");
        assert.include(text, "je m’appelle Camille Synthetic");
        assert.include(html, 'href="https://app.example.test/fr/"');
        assert.include(html, "/api/email-assets/header.gif");
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
          assert.include(part, "November 10, 2026 at 9:00 AM UTC");
          assert.include(part, calendarUrl);
        }

        assert.include(text, "November 10, 2026 at 9:00 AM UTC: Hello");
        assert.include(html, ">Hello</div>");
      })
    );
  });
});
