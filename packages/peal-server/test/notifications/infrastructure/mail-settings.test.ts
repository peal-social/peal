import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

import {
  mailIdentityConfig,
  mailSettingsConfig,
  maxIdentityLength,
} from "#notifications/infrastructure/mail-settings.ts";

const settingsFrom = (env: Record<string, string>) =>
  mailSettingsConfig.parse(ConfigProvider.fromUnknown(env));

describe("the mail settings", () => {
  it.effect("send through Mailpit outside production", () =>
    Effect.gen(function* development() {
      const { senders, transport } = yield* settingsFrom({});

      assert.deepStrictEqual(senders, {
        automatic: "Peal <noreply@peal.localhost>",
        personal: "Peal <noreply@peal.localhost>",
      });
      assert.strictEqual(transport._tag, "Smtp");
      assert.strictEqual(
        transport._tag === "Smtp" ? Redacted.value(transport.url) : "",
        "smtp://127.0.0.1:11025"
      );
    })
  );

  it.effect("prefer Resend when it has a key", () =>
    Effect.gen(function* resend() {
      const { transport } = yield* settingsFrom({
        MAIL_FROM: "Peal <noreply@example.test>",
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test_key",
        SMTP_URL: "smtp://mail.example.test:587",
      });

      assert.strictEqual(transport._tag, "Resend");
    })
  );

  it.effect("send through SMTP_URL in production", () =>
    Effect.gen(function* smtp() {
      const { transport } = yield* settingsFrom({
        MAIL_FROM: "noreply@example.test",
        NODE_ENV: "production",
        SMTP_URL: "smtps://user:secret@mail.example.test:465",
      });

      assert.strictEqual(transport._tag, "Smtp");
    })
  );

  it.effect.each([
    { env: {}, personal: "Peal <noreply@example.test>" },
    {
      env: { PEAL_MAIL_PERSONAL_FROM: "" },
      personal: "Peal <noreply@example.test>",
    },
    {
      env: { PEAL_MAIL_PERSONAL_FROM: "  " },
      personal: "Peal <noreply@example.test>",
    },
    {
      env: { PEAL_MAIL_PERSONAL_FROM: "Ada at Synthetic <ada@example.test>" },
      personal: "Ada at Synthetic <ada@example.test>",
    },
  ])(
    "send what a person signs from their address, or MAIL_FROM: $env",
    ({ env, personal }) =>
      Effect.gen(function* signed() {
        const { senders } = yield* settingsFrom({
          ...env,
          MAIL_FROM: "Peal <noreply@example.test>",
        });

        assert.deepStrictEqual(senders, {
          automatic: "Peal <noreply@example.test>",
          personal,
        });
      })
  );

  it.effect.each([
    {
      env: { NODE_ENV: "production", SMTP_URL: "smtp://mail.example.test" },
      missing: "MAIL_FROM",
    },
    {
      env: { MAIL_FROM: "noreply@example.test", NODE_ENV: "production" },
      missing: "SMTP_URL",
    },
  ])("need $missing in production", ({ env, missing }) =>
    Effect.gen(function* required() {
      const failure = yield* settingsFrom(env).pipe(Effect.flip);

      assert.include(String(failure), missing);
    })
  );
});

const identityFrom = (env: Record<string, string>) =>
  mailIdentityConfig.parse(ConfigProvider.fromEnv({ env }));

const english = "Synthetic Studio, registered office: 1 Example St";
const french = "Synthetic Studio, siège social : 1 Example St";

describe("who sends, as the operator states it", () => {
  it.effect.each([
    { env: {}, stated: { en: Option.none(), fr: Option.none() } },
    {
      env: { PEAL_MAIL_IDENTITY: "", PEAL_MAIL_IDENTITY_FR: "" },
      stated: { en: Option.none(), fr: Option.none() },
    },
    {
      env: { PEAL_MAIL_IDENTITY: "   " },
      stated: { en: Option.none(), fr: Option.none() },
    },
    {
      env: { PEAL_MAIL_IDENTITY: " Synthetic Studio SAS · 1 Example St " },
      stated: {
        en: Option.some("Synthetic Studio SAS · 1 Example St"),
        fr: Option.some("Synthetic Studio SAS · 1 Example St"),
      },
    },
    {
      env: { PEAL_MAIL_IDENTITY: "x".repeat(maxIdentityLength) },
      stated: {
        en: Option.some("x".repeat(maxIdentityLength)),
        fr: Option.some("x".repeat(maxIdentityLength)),
      },
    },
    {
      env: { PEAL_MAIL_IDENTITY: english, PEAL_MAIL_IDENTITY_FR: french },
      stated: { en: Option.some(english), fr: Option.some(french) },
    },
    {
      env: { PEAL_MAIL_IDENTITY_FR: french },
      stated: { en: Option.none(), fr: Option.some(french) },
    },
    {
      env: { PEAL_MAIL_IDENTITY: english, PEAL_MAIL_IDENTITY_FR: "" },
      stated: { en: Option.some(english), fr: Option.some(english) },
    },
    {
      env: { PEAL_MAIL_IDENTITY: english, PEAL_MAIL_IDENTITY_FR: " " },
      stated: { en: Option.some(english), fr: Option.some(english) },
    },
  ])("is read from $env", ({ env, stated }) =>
    Effect.gen(function* read() {
      assert.deepStrictEqual(yield* identityFrom(env), stated);
    })
  );

  it.effect.each(
    ["PEAL_MAIL_IDENTITY", "PEAL_MAIL_IDENTITY_FR"].flatMap((name) => [
      { name, value: "Synthetic Studio SAS\n1 Example St", what: "two lines" },
      { name, value: "Synthetic Studio\u2028SAS", what: "a line separator" },
      { name, value: "Synthetic\u0007Studio", what: "a control character" },
      {
        name,
        value: "x".repeat(maxIdentityLength + 1),
        what: "too long a line",
      },
    ])
  )("refuses $what in $name", ({ name, value }) =>
    Effect.gen(function* refused() {
      const failure = yield* identityFrom({ [name]: value }).pipe(Effect.flip);

      assert.include(String(failure), name);
    })
  );
});
