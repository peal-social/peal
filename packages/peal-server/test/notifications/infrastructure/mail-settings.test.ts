import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";

import {
  mailIdentityConfig,
  mailSettingsConfig,
  mailWelcomeSignerConfig,
  maxIdentityLength,
  maxPersonalFromLength,
  maxSignerLength,
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
    { from: "ada@example.test" },
    { from: "Ada <ada@example.test>" },
    { from: "<ada@example.test>" },
    { from: '"Synthetic, Ada" <ada@example.test>' },
    { from: '"Ada (Synthetic)" <ada@example.test>' },
    { from: '"Ada: Synthetic; [a]" <ada@example.test>' },
    { from: '"Ada @ Synthetic" <ada@example.test>' },
    { from: "Adèle O’Synthetic-Née Jr. <ada+mail@sub.example.test>" },
    { from: "علی\u200Cرضا <ada@example.test>" },
    { from: "अक्\u200Dषय <ada@example.test>" },
    { from: "Ada 👩\u200D💻 <ada@example.test>" },
  ])("take a person's address written as $from", ({ from }) =>
    Effect.gen(function* taken() {
      const { senders } = yield* settingsFrom({
        MAIL_FROM: "noreply@example.test",
        PEAL_MAIL_PERSONAL_FROM: ` ${from} `,
      });

      assert.strictEqual(senders.personal, from);
    })
  );

  it.effect.each([
    { value: "Ada", what: "no address" },
    { value: "ada@", what: "half an address" },
    { value: "Ada <ada.example.test>", what: "an address without an @" },
    { value: "Ada ada@example.test", what: "a name and a bare address" },
    { value: "ada@example.test, grace@example.test", what: "two addresses" },
    {
      value: "Ada <ada@example.test>, Grace <grace@example.test>",
      what: "two named addresses",
    },
    { value: "Synthetic, Ada <ada@example.test>", what: "an unquoted comma" },
    { value: "Team: ada@example.test;", what: "a group" },
    {
      value: "Ada (Synthetic) <ada@example.test>",
      what: "unquoted parentheses",
    },
    { value: "Ada: Synthetic <ada@example.test>", what: "an unquoted colon" },
    { value: "Ada @ Synthetic <ada@example.test>", what: "an unquoted @" },
    { value: "Ada <ada@example.test> (home)", what: "a comment" },
    { value: "Ada <ada@example.test", what: "an open angle bracket" },
    {
      value: "ada@grace.test <ada@example.test>",
      what: "an address as a name",
    },
    {
      value: "Ada <ada@example.test>\r\nBcc: grace@example.test",
      what: "another header",
    },
    { value: "Ada\u2028 <ada@example.test>", what: "a line separator" },
    { value: "Ada \u202Etset <ada@example.test>", what: "a bidi override" },
    { value: "Ada <ad\u200Ba@example.test>", what: "a zero-width space" },
    { value: "Ada <ad\u200Ca@example.test>", what: "a joiner in the address" },
    {
      value: `${"x".repeat(maxPersonalFromLength)} <ada@example.test>`,
      what: "too long a line",
    },
  ])("refuse $what as the person's address", ({ value }) =>
    Effect.gen(function* refused() {
      const failure = yield* settingsFrom({
        MAIL_FROM: "noreply@example.test",
        PEAL_MAIL_PERSONAL_FROM: value,
      }).pipe(Effect.flip);

      assert.include(String(failure), "PEAL_MAIL_PERSONAL_FROM");
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
      { name, value: "Synthetic\u202EStudio", what: "a bidi override" },
      { name, value: "Synthetic\u200BStudio", what: "a zero-width space" },
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

const signerFrom = (env: Record<string, string>) =>
  mailWelcomeSignerConfig.parse(ConfigProvider.fromEnv({ env }));

describe("who signs the welcome, which turns it on", () => {
  it.effect.each([
    { env: {}, signer: Option.none() },
    { env: { PEAL_MAIL_WELCOME_SIGNER: "" }, signer: Option.none() },
    { env: { PEAL_MAIL_WELCOME_SIGNER: "  " }, signer: Option.none() },
    {
      env: { PEAL_MAIL_WELCOME_SIGNER: " Ada Synthetic " },
      signer: Option.some("Ada Synthetic"),
    },
    ...[
      "Adèle O’Synthetic-Née",
      "Søren Æ.",
      "José Ñ",
      "李小龍",
      "Νίκος",
      "Дарья",
      "עדה",
      "عائشة",
      // Joiners are letters' shapes in Persian, Hindi and emoji.
      "علی\u200Cرضا",
      "अक्\u200Dषय",
      "Ada 👩\u200D💻",
    ].map((name) => ({
      env: { PEAL_MAIL_WELCOME_SIGNER: name },
      signer: Option.some(name),
    })),
    {
      env: { PEAL_MAIL_WELCOME_SIGNER: "x".repeat(maxSignerLength) },
      signer: Option.some("x".repeat(maxSignerLength)),
    },
  ])("is read from $env", ({ env, signer }) =>
    Effect.gen(function* read() {
      assert.deepStrictEqual(yield* signerFrom(env), signer);
    })
  );

  it.effect.each([
    { value: "Ada\nSynthetic", what: "two lines" },
    { value: "Ada\u2029Synthetic", what: "a paragraph separator" },
    { value: "Ada\u2066Synthetic", what: "a bidi isolate" },
    { value: "Ada\uFEFFSynthetic", what: "a zero-width no-break space" },
    { value: "Ada\u200ESynthetic", what: "a left-to-right mark" },
    { value: "x".repeat(maxSignerLength + 1), what: "too long a name" },
  ])("refuses $what", ({ value }) =>
    Effect.gen(function* refused() {
      const failure = yield* signerFrom({
        PEAL_MAIL_WELCOME_SIGNER: value,
      }).pipe(Effect.flip);

      assert.include(String(failure), "PEAL_MAIL_WELCOME_SIGNER");
    })
  );
});
