import { Context, Effect, Layer, Option, Ref } from "effect";

import { AppLinks } from "#notifications/application/app-links.ts";
import { EmailRenderer } from "#notifications/application/email-renderer.ts";
import { SendWelcomeEmail } from "#notifications/application/send-welcome-email.ts";
import { WelcomeReaders } from "#notifications/application/welcome-readers.ts";
import type { WelcomeReader } from "#notifications/application/welcome-readers.ts";
import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";
import type { UserId } from "#shared/domain/ids.ts";
import { TestMailer } from "#test/notifications/test-mailer.ts";

/** A welcome renderer that answers at once, saying what it was asked. */
export const toldWelcomes = Layer.succeed(
  EmailRenderer,
  EmailRenderer.of({
    account: () => Effect.die(new Error("Not an account email")),
    notice: () => Effect.die(new Error("Not a notice")),
    weeklyDigest: () => Effect.die(new Error("Not a digest")),
    welcome: ({ locale, signer, url }) =>
      Effect.succeed({
        html: `<p>${url}</p>`,
        subject: `Welcome in ${locale} from ${signer}`,
        text: url,
      }),
  })
);

const testLinks = Layer.succeed(
  AppLinks,
  AppLinks.of({
    api: (path) => `https://app.example.test${path}`,
    url: (path, locale) => `https://app.example.test/${locale}${path}`,
  })
);

/** The accounts a welcome may go to, as tests set them. */
export class TestReaders extends Context.Service<
  TestReaders,
  {
    readonly reads: Effect.Effect<number>;
    /** How many times one account was read. */
    readonly readsOf: (userId: UserId) => Effect.Effect<number>;
    readonly set: (
      userId: UserId,
      reader: WelcomeReader | null
    ) => Effect.Effect<void>;
  }
>()("peal-server/test/notifications/TestReaders") {
  static readonly layer = Layer.effectContext(
    Effect.gen(function* TestReadersLive() {
      const read = yield* Ref.make<readonly UserId[]>([]);

      const readers = yield* Ref.make<ReadonlyMap<UserId, WelcomeReader>>(
        new Map()
      );

      return Context.make(
        WelcomeReaders,
        WelcomeReaders.of({
          readerOf: (userId) =>
            Ref.update(read, (all) => [...all, userId]).pipe(
              Effect.andThen(Ref.get(readers)),
              Effect.map((all) => Option.fromUndefinedOr(all.get(userId)))
            ),
        })
      ).pipe(
        Context.add(
          TestReaders,
          TestReaders.of({
            reads: Ref.get(read).pipe(Effect.map(({ length }) => length)),
            readsOf: (userId) =>
              Ref.get(read).pipe(
                Effect.map((all) => all.filter((id) => id === userId).length)
              ),
            set: (userId, reader) =>
              Ref.update(readers, (all) => {
                const others = [...all].filter(([id]) => id !== userId);

                return new Map(
                  reader === null ? others : [...others, [userId, reader]]
                );
              }),
          })
        )
      );
    })
  );
}

/** What names the test's personal sender in a welcome's key. */
export const senderDigest = "synthetic-sender";

/** A server whose welcomes this person signs, or that sends none. */
export const signedBy = (name: string | null) =>
  Layer.succeed(
    WelcomeSigner,
    WelcomeSigner.of({ name: Option.fromNullOr(name), senderDigest })
  );

/** The accounts and the mailer, which outlive a server that restarts. */
export const WelcomeWorld = Layer.merge(TestReaders.layer, TestMailer.layer);

/** What sends a welcome, on a server whose welcomes `name` signs. */
export const welcomesSignedBy = (name: string | null) =>
  SendWelcomeEmail.layer.pipe(
    Layer.provide([toldWelcomes, testLinks, signedBy(name)])
  );

export const welcomeReader: WelcomeReader = {
  email: "ada@example.test",
  emailConfirmed: true,
  locale: "fr",
};
