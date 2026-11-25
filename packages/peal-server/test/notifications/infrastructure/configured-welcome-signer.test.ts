import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option } from "effect";

import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";
import { ConfiguredWelcomeSigner } from "#notifications/infrastructure/configured-welcome-signer.ts";

const signerOf = (env: Readonly<Record<string, string>>) =>
  WelcomeSigner.use((signer) => Effect.succeed(signer)).pipe(
    Effect.provide(
      ConfiguredWelcomeSigner.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      )
    )
  );

const personal = "Ada at Synthetic <ada@example.test>";

describe("who signs the welcome, as the settings name them", () => {
  it.effect("names the sender by a digest that changes with it alone", () =>
    Effect.gen(function* digested() {
      const first = yield* signerOf({ PEAL_MAIL_PERSONAL_FROM: personal });

      // Another start of the server, with other settings changed.
      const again = yield* signerOf({
        MAIL_FROM: "Synthetic <noreply@example.test>",
        PEAL_MAIL_PERSONAL_FROM: ` ${personal} `,
        PEAL_MAIL_WELCOME_SIGNER: "Ada",
      });

      const corrected = yield* signerOf({
        PEAL_MAIL_PERSONAL_FROM: "Ada at Synthetic <ada@mail.example.test>",
      });

      assert.match(first.senderDigest, /^[0-9a-f]{64}$/u);
      assert.strictEqual(again.senderDigest, first.senderDigest);
      assert.notStrictEqual(corrected.senderDigest, first.senderDigest);
      assert.deepStrictEqual(again.name, Option.some("Ada"));
      assert.deepStrictEqual(first.name, Option.none());
    })
  );

  it.effect("takes MAIL_FROM for a server without a person's address", () =>
    Effect.gen(function* fallsBack() {
      const fallenBack = yield* signerOf({ MAIL_FROM: personal });
      const set = yield* signerOf({ PEAL_MAIL_PERSONAL_FROM: personal });

      assert.strictEqual(fallenBack.senderDigest, set.senderDigest);
    })
  );
});
