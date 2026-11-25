import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";

import { assert, describe, it } from "@effect/vitest";
import { Config, Effect, Redacted, Schema } from "effect";

import { Mailer } from "#notifications/application/mailer.ts";
import { smtpMailer } from "#notifications/infrastructure/smtp-mailer.ts";

// The development stack's Mailpit, or the one SMTP_URL and MAILPIT_URL name.
const smtpUrl = Config.String("SMTP_URL").pipe(
  Config.withDefault("smtp://127.0.0.1:11025")
);

const mailpitUrl = Config.String("MAILPIT_URL").pipe(
  Config.withDefault("http://127.0.0.1:18025")
);

const SearchSchema = Schema.Struct({
  messages: Schema.Array(
    Schema.Struct({
      From: Schema.Struct({ Address: Schema.String, Name: Schema.String }),
      ID: Schema.String,
      Subject: Schema.String,
    })
  ),
});

const MessageSchema = Schema.Struct({
  HTML: Schema.String,
  Text: Schema.String,
});

const getJson = <S extends Schema.Top>(url: string, schema: S) =>
  Effect.promise(async () => {
    const response = await fetch(url);
    const json: unknown = await response.json();

    return json;
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(schema)));

const ListeningSchema = Schema.Struct({ port: Schema.Number });

// An SMTP server that takes every command but `at`, which it answers with
// `reply`.
const refusingServer = (at: string, reply: string) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const server = createServer((socket) => {
        let inData = false;

        socket.on("error", () => {
          // The client may leave first.
        });

        socket.on("data", (chunk) => {
          for (const line of chunk.toString().split("\r\n")) {
            if (inData) {
              if (line === ".") {
                inData = false;
                socket.write(`${at === "DATA" ? reply : "250 OK"}\r\n`);
              }
            } else if (line.startsWith("EHLO")) {
              socket.write("250 synthetic.example.test\r\n");
            } else if (line === "DATA") {
              inData = true;
              socket.write("354 Go on\r\n");
            } else if (line !== "") {
              socket.write(`${line.startsWith(at) ? reply : "250 OK"}\r\n`);
            }
          }
        });

        socket.write("220 synthetic.example.test\r\n");
      });

      server.listen(0, "127.0.0.1");
      await once(server, "listening");

      return server;
    }),
    (server) =>
      Effect.sync(() => {
        server.close();
      })
  ).pipe(
    Effect.flatMap((server) =>
      Schema.decodeUnknownEffect(ListeningSchema)(server.address())
    ),
    Effect.map(({ port }) => `smtp://127.0.0.1:${port}`)
  );

describe("the SMTP mailer", () => {
  it.live("delivers the email to the SMTP server", () =>
    Effect.gen(function* delivers() {
      const to = `smtp-test+${randomUUID()}@example.test`;
      const url = yield* smtpUrl;
      const mailpit = yield* mailpitUrl;

      yield* Mailer.use((mailer) =>
        mailer.send({
          headers: {
            "List-Unsubscribe": "<https://app.example.test/api/u/x>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          html: "<p>Bonjour</p>",
          idempotencyKey: "00000000-0000-7000-8000-000000000001",
          subject: "Bonjour",
          text: "Bonjour",
          to,
        })
      ).pipe(
        Effect.provide(
          smtpMailer({
            senders: {
              automatic: "Peal <noreply@example.test>",
              personal: "Ada at Synthetic <ada@example.test>",
            },
            url: Redacted.make(url),
          })
        )
      );

      // Mailpit stores the email once the SMTP session ends.
      const query = new URLSearchParams({ query: `to:"${to}"` });

      const { messages } = yield* getJson(
        `${mailpit}/api/v1/search?${query.toString()}`,
        SearchSchema
      );

      const [found] = messages;

      assert.isDefined(found);
      assert.strictEqual(found?.Subject, "Bonjour");
      assert.deepStrictEqual(found?.From, {
        Address: "noreply@example.test",
        Name: "Peal",
      });

      const message = yield* getJson(
        `${mailpit}/api/v1/message/${found?.ID ?? ""}`,
        MessageSchema
      );

      assert.strictEqual(message.HTML, "<p>Bonjour</p>");
      assert.strictEqual(message.Text.trim(), "Bonjour");

      const headers = yield* getJson(
        `${mailpit}/api/v1/message/${found?.ID ?? ""}/headers`,
        Schema.Record(Schema.String, Schema.Array(Schema.String))
      );

      assert.deepStrictEqual(headers["List-Unsubscribe"], [
        "<https://app.example.test/api/u/x>",
      ]);
      assert.deepStrictEqual(headers["List-Unsubscribe-Post"], [
        "List-Unsubscribe=One-Click",
      ]);
    })
  );

  it.live.each([
    {
      from: { Address: "ada@example.test", Name: "Ada at Synthetic" },
      personal: "Ada at Synthetic <ada@example.test>",
      sender: "personal" as const,
      what: "a personal email from the person's address",
    },
    {
      from: { Address: "ada@example.test", Name: "Synthetic, Ada (a @ b)" },
      personal: '"Synthetic, Ada (a @ b)" <ada@example.test>',
      sender: "personal" as const,
      what: "a personal email under a quoted name",
    },
    {
      from: { Address: "noreply@example.test", Name: "Peal" },
      personal: "Ada at Synthetic <ada@example.test>",
      sender: "automatic" as const,
      what: "an automatic email from MAIL_FROM",
    },
    {
      from: { Address: "noreply@example.test", Name: "Peal" },
      personal: "Peal <noreply@example.test>",
      sender: "personal" as const,
      what: "a personal email from MAIL_FROM where no person is set",
    },
  ])("sends $what", ({ from, personal, sender }) =>
    Effect.gen(function* sendsAs() {
      const to = `smtp-sender+${randomUUID()}@example.test`;
      const url = yield* smtpUrl;
      const mailpit = yield* mailpitUrl;

      yield* Mailer.use((mailer) =>
        mailer.send({
          html: "<p>Hello</p>",
          idempotencyKey: "00000000-0000-7000-8000-000000000003",
          sender,
          subject: "Hello",
          text: "Hello",
          to,
        })
      ).pipe(
        Effect.provide(
          smtpMailer({
            senders: { automatic: "Peal <noreply@example.test>", personal },
            url: Redacted.make(url),
          })
        )
      );

      const query = new URLSearchParams({ query: `to:"${to}"` });

      const { messages } = yield* getJson(
        `${mailpit}/api/v1/search?${query.toString()}`,
        SearchSchema
      );

      assert.deepStrictEqual(
        messages.map(({ From }) => From),
        [from]
      );

      const headers = yield* getJson(
        `${mailpit}/api/v1/message/${messages[0]?.ID ?? ""}/headers`,
        Schema.Record(Schema.String, Schema.Array(Schema.String))
      );

      // A reply goes to the address the email came from.
      assert.notProperty(headers, "Reply-To");
      assert.deepStrictEqual(headers["Return-Path"], [`<${from.Address}>`]);
    })
  );

  it.live("fails, retryable, when the server does not answer", () =>
    Effect.gen(function* refused() {
      const failure = yield* Mailer.use((mailer) =>
        mailer.send({
          html: "<p>Hello</p>",
          idempotencyKey: "00000000-0000-7000-8000-000000000002",
          subject: "Hello",
          text: "Hello",
          to: "nobody@example.test",
        })
      ).pipe(
        Effect.provide(
          smtpMailer({
            senders: {
              automatic: "noreply@example.test",
              personal: "noreply@example.test",
            },
            // Nothing listens on port 1.
            url: Redacted.make("smtp://127.0.0.1:1"),
          })
        ),
        Effect.flip
      );

      assert.isTrue(failure.retryable);
    })
  );

  it.live.each([
    {
      at: "RCPT TO",
      refusedFor: "recipient",
      reply: "550 5.1.1 <nobody@example.test>: Recipient address rejected",
    },
    {
      at: "RCPT TO",
      refusedFor: "recipient",
      reply: "552 5.2.2 Mailbox full",
    },
    // No enhanced code: it may be the sender or the relay.
    { at: "RCPT TO", refusedFor: undefined, reply: "550 No such user here" },
    { at: "RCPT TO", refusedFor: undefined, reply: "554 Access denied" },
    {
      at: "RCPT TO",
      refusedFor: undefined,
      reply: "554 5.7.1 <ada@example.test>: Relay access denied",
    },
    {
      at: "RCPT TO",
      refusedFor: undefined,
      reply: "553 5.7.1 <ada@example.test>: Sender address rejected",
    },
    {
      at: "RCPT TO",
      refusedFor: undefined,
      reply: "550 5.1.8 <ada@example.test>: Sender address rejected",
    },
    {
      at: "MAIL FROM",
      refusedFor: undefined,
      reply: "553 5.1.8 Sender address not verified",
    },
    {
      at: "DATA",
      refusedFor: undefined,
      reply: "554 5.6.0 Message content rejected",
    },
  ])("says a refusal at $at is for $refusedFor: $reply", (sample) =>
    Effect.gen(function* says() {
      const url = yield* refusingServer(sample.at, sample.reply);

      const failure = yield* Mailer.use((mailer) =>
        mailer.send({
          html: "<p>Hello</p>",
          idempotencyKey: "00000000-0000-7000-8000-000000000004",
          subject: "Hello",
          text: "Hello",
          to: "nobody@example.test",
        })
      ).pipe(
        Effect.provide(
          smtpMailer({
            senders: {
              automatic: "noreply@example.test",
              personal: "noreply@example.test",
            },
            url: Redacted.make(url),
          })
        ),
        Effect.flip
      );

      assert.strictEqual(failure.refusedFor, sample.refusedFor);
      assert.isFalse(failure.retryable);
    }).pipe(Effect.scoped)
  );
});
