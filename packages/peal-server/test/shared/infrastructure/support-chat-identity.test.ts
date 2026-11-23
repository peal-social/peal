// The support chat's identity: the chat provider verifies an email by its
// HMAC-SHA256 under the website's secret, in hex, and GET /api/me hands
// the web app the signature of the session's own email alone.
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect";
import { Mac, SecureRandom } from "effect/crypto";

import { SupportChatIdentity } from "#shared/application/support-chat-identity.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import {
  emailSignatureOf,
  supportChatIdentityOf,
  supportChatSecretConfig,
  SupportChatIdentityLive,
} from "#shared/infrastructure/support-chat-identity.ts";
import { supportChatOf } from "#workspace/api/session.ts";
import { Account } from "#workspace/domain/account.ts";
import { UserPrincipal } from "#workspace/domain/user-principal.ts";

const mac = Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));

const secret = Redacted.make("synthetic_identity_secret");

// The address GET /api/me reads from the account.
const email = "ada@example.test";

const userId = UserIdSchema.make("3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f");
const staffId = UserIdSchema.make("8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0db4");

const accountWith = (emailVerified: boolean) =>
  new Account({
    ban: Option.none(),
    browserAnalyticsConsent: Option.none(),
    email,
    emailVerified,
    hasPassword: true,
    id: userId,
    image: Option.none(),
    locale: "en",
    name: "Ada",
    twoStepEnabled: false,
    workspaces: [],
  });

const account = accountWith(true);

const signedInAs = (principal: UserPrincipal) => ({
  account,
  principal,
  workspaces: [],
});

const inPerson = new UserPrincipal({
  impersonatedBy: Option.none(),
  oauth: Option.none(),
  userId,
});

const withSecret = supportChatIdentityOf(Option.some(secret)).pipe(
  Layer.provide(mac)
);

const fromEnv = (env: Record<string, string>) =>
  SupportChatIdentityLive.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
  );

describe("the support chat's email signature", () => {
  it.effect("is HMAC-SHA256 in hex, as a fixed vector has it", () =>
    Effect.gen(function* vector() {
      assert.strictEqual(
        yield* emailSignatureOf(
          Redacted.make("key"),
          "The quick brown fox jumps over the lazy dog"
        ),
        "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
      );
      assert.strictEqual(
        yield* emailSignatureOf(secret, email),
        "a4c921058897c197f1db3c26023ca8bc06b14a14eb1ae2d0d81967327859471b"
      );
    }).pipe(Effect.provide(mac))
  );

  it.effect("signs nothing without the secret, or with a blank one", () =>
    Effect.gen(function* none() {
      for (const env of [{}, { PEAL_CRISP_IDENTITY_SECRET: "  " }]) {
        const signed = yield* SupportChatIdentity.use(({ sign }) =>
          sign(email)
        ).pipe(Effect.provide(fromEnv(env)));

        assert.isTrue(Option.isNone(signed));
      }

      assert.isTrue(
        Option.isNone(
          yield* supportChatSecretConfig.pipe(
            Effect.provide(
              ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))
            )
          )
        )
      );
    })
  );

  it.effect("signs with the secret the setting names", () =>
    Effect.gen(function* set() {
      const signed = yield* SupportChatIdentity.use(({ sign }) =>
        sign(email)
      ).pipe(
        Effect.provide(
          fromEnv({ PEAL_CRISP_IDENTITY_SECRET: "synthetic_identity_secret" })
        )
      );

      assert.deepStrictEqual(
        signed,
        Option.some(
          "a4c921058897c197f1db3c26023ca8bc06b14a14eb1ae2d0d81967327859471b"
        )
      );
    })
  );
});

describe("the support chat in GET /api/me", () => {
  it.effect("signs the account's own email in the person's session", () =>
    Effect.gen(function* own() {
      assert.deepStrictEqual(yield* supportChatOf(signedInAs(inPerson)), {
        emailSignature:
          "a4c921058897c197f1db3c26023ca8bc06b14a14eb1ae2d0d81967327859471b",
      });
    }).pipe(Effect.provide(withSecret))
  );

  it.effect(
    "is null without the secret, for staff acting as the person, and through an application",
    () =>
      Effect.gen(function* never() {
        assert.isNull(
          yield* supportChatOf(signedInAs(inPerson)).pipe(
            Effect.provide(SupportChatIdentity.none)
          )
        );

        const impersonated = new UserPrincipal({
          impersonatedBy: Option.some(staffId),
          oauth: Option.none(),
          userId,
        });

        const throughApplication = new UserPrincipal({
          impersonatedBy: Option.none(),
          oauth: Option.some({
            clientId: "synthetic-agent",
            scopes: ["workspace:read"],
            workspaceId: Option.none(),
          }),
          userId,
        });

        // An address nobody confirmed is never signed.
        assert.isNull(
          yield* supportChatOf({
            ...signedInAs(inPerson),
            account: accountWith(false),
          }).pipe(Effect.provide(withSecret))
        );

        assert.isNull(
          yield* supportChatOf(signedInAs(impersonated)).pipe(
            Effect.provide(withSecret)
          )
        );
        assert.isNull(
          yield* supportChatOf(signedInAs(throughApplication)).pipe(
            Effect.provide(withSecret)
          )
        );
      })
  );
});
