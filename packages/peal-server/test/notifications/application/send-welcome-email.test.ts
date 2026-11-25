import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { SendWelcomeEmail } from "#notifications/application/send-welcome-email.ts";
import { TestMailer } from "#test/notifications/test-mailer.ts";
import {
  TestReaders,
  welcomeReader,
  welcomesSignedBy,
  WelcomeWorld,
} from "#test/notifications/welcome-support.ts";
import { sampleUserId as userId } from "#test/shared/product-event-samples.ts";

const deliver = SendWelcomeEmail.use((welcomes) => welcomes.deliver(userId));

const sent = TestMailer.use((mailer) => mailer.sent);

const given = (reader: Parameters<TestReaders["Service"]["set"]>[1]) =>
  TestReaders.use((readers) => readers.set(userId, reader));

const answering = (mode: "accept" | "refuse" | "refuseForNow") =>
  TestMailer.use((mailer) => mailer.setMode(mode));

describe(SendWelcomeEmail, () => {
  layer(
    welcomesSignedBy("Camille Synthetic").pipe(Layer.provideMerge(WelcomeWorld))
  )((it) => {
    it.effect(
      "sends it as the person who signs it, in the account's language",
      () =>
        Effect.gen(function* sends() {
          yield* given(welcomeReader);

          const before = yield* sent;

          assert.strictEqual(yield* deliver, "sent");

          const after = yield* sent;

          assert.deepStrictEqual(after.slice(before.length), [
            {
              html: "<p>https://app.example.test/fr/</p>",
              idempotencyKey: `welcome:${userId}`,
              sender: "personal",
              subject: "Welcome in fr from Camille Synthetic",
              text: "https://app.example.test/fr/",
              to: "ada@example.test",
            },
          ]);
        })
    );

    it.effect("waits for an address to be confirmed", () =>
      Effect.gen(function* waits() {
        yield* given({ ...welcomeReader, emailConfirmed: false });

        const before = yield* sent;

        assert.strictEqual(yield* deliver, "wait");
        assert.lengthOf(yield* sent, before.length);
      })
    );

    it.effect("sends none to an account that is banned or gone", () =>
      Effect.gen(function* skips() {
        yield* given(null);

        const before = yield* sent;

        assert.strictEqual(yield* deliver, "skip");
        assert.lengthOf(yield* sent, before.length);
      })
    );

    it.effect("waits for a transport that refuses for now", () =>
      Effect.gen(function* refusedForNow() {
        yield* given(welcomeReader);
        yield* answering("refuseForNow");

        assert.strictEqual(yield* deliver, "wait");

        yield* answering("accept");

        assert.strictEqual(yield* deliver, "sent");
      })
    );

    it.effect("ends with a transport that refuses for good", () =>
      Effect.gen(function* refused() {
        yield* given(welcomeReader);
        yield* answering("refuse");

        assert.strictEqual(yield* deliver, "skip");

        yield* answering("accept");
      })
    );
  });

  layer(welcomesSignedBy(null).pipe(Layer.provideMerge(WelcomeWorld)))((it) => {
    it.effect("sends none where nobody signs it, and reads no account", () =>
      Effect.gen(function* off() {
        yield* given(welcomeReader);

        assert.strictEqual(yield* deliver, "skip");
        assert.deepStrictEqual(yield* sent, []);
        assert.strictEqual(
          yield* TestReaders.use((readers) => readers.reads),
          0
        );
      })
    );
  });
});
