import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

import { Mailer } from "#notifications/application/mailer.ts";
import { resendMailer } from "#notifications/infrastructure/resend-mailer.ts";

const message = {
  html: "<p>Hello</p>",
  idempotencyKey: "00000000-0000-7000-8000-000000000001",
  subject: "Hello",
  text: "Hello",
  to: "ada@example.test",
};

// The senders of a server, whose personal one is the automatic one unless
// set.
const sendersOf = ({
  personal = "Peal <noreply@example.test>",
}: {
  readonly personal?: string;
}) => ({ automatic: "Peal <noreply@example.test>", personal });

// Resend, answering every request with `status`, and the requests it got.
const resendAnswering = (status: number, senders = sendersOf({})) => {
  const requests: Request[] = [];

  const fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      requests.push(
        input instanceof Request
          ? new Request(input, init)
          : new Request(input.toString(), init)
      );

      return await Promise.resolve(
        Response.json({ id: "email-1" }, { status })
      );
    },
    {
      preconnect: () => {
        // These requests never leave the process.
      },
    }
  );

  const layer = resendMailer({
    apiKey: Redacted.make("re_test_key"),
    senders,
  }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
  );

  return { layer, requests };
};

const BodySchema = Schema.fromJsonString(
  Schema.Struct({
    from: Schema.String,
    headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    reply_to: Schema.optionalKey(Schema.Unknown),
    html: Schema.String,
    subject: Schema.String,
    text: Schema.String,
    to: Schema.Array(Schema.String),
  })
);

describe("the Resend mailer", () => {
  it.effect("posts the email with the API key and its idempotency key", () => {
    const { layer, requests } = resendAnswering(200);

    return Effect.gen(function* posts() {
      yield* Mailer.use((mailer) => mailer.send(message));

      const [request] = requests;

      assert.isDefined(request);
      assert.strictEqual(request?.url, "https://api.resend.com/emails");
      assert.strictEqual(request?.method, "POST");
      assert.strictEqual(
        request?.headers.get("authorization"),
        "Bearer re_test_key"
      );
      assert.strictEqual(
        request?.headers.get("idempotency-key"),
        message.idempotencyKey
      );

      const body = yield* Schema.decodeUnknownEffect(BodySchema)(
        yield* Effect.promise(async () => (await request?.text()) ?? "")
      );

      assert.deepStrictEqual(body, {
        from: "Peal <noreply@example.test>",
        headers: {},
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: [message.to],
      });
    }).pipe(Effect.provide(layer));
  });

  it.effect(
    "sends the headers a message names, such as an unsubscribe link",
    () => {
      const { layer, requests } = resendAnswering(200);

      const headers = {
        "List-Unsubscribe": "<https://app.example.test/api/u/x>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };

      return Effect.gen(function* withHeaders() {
        yield* Mailer.use((mailer) => mailer.send({ ...message, headers }));

        const body = yield* Schema.decodeUnknownEffect(BodySchema)(
          yield* Effect.promise(async () => (await requests[0]?.text()) ?? "")
        );

        assert.deepStrictEqual(body.headers, headers);
      }).pipe(Effect.provide(layer));
    }
  );

  it.effect.each([
    { from: "Peal <noreply@example.test>", sender: undefined },
    { from: "Peal <noreply@example.test>", sender: "automatic" as const },
    {
      from: "Ada at Synthetic <ada@example.test>",
      sender: "personal" as const,
    },
  ])("sends as $from for the sender $sender", ({ from, sender }) => {
    const { layer, requests } = resendAnswering(
      200,
      sendersOf({ personal: "Ada at Synthetic <ada@example.test>" })
    );

    return Effect.gen(function* sendsAs() {
      yield* Mailer.use((mailer) =>
        mailer.send(sender === undefined ? message : { ...message, sender })
      );

      const body = yield* Schema.decodeUnknownEffect(BodySchema)(
        yield* Effect.promise(async () => (await requests[0]?.text()) ?? "")
      );

      assert.strictEqual(body.from, from);
      // A reply goes to the address the email came from.
      assert.notProperty(body, "reply_to");
      assert.deepStrictEqual(body.headers, {});
    }).pipe(Effect.provide(layer));
  });

  it.effect("sends what a person signs as MAIL_FROM where none is set", () => {
    const { layer, requests } = resendAnswering(200);

    return Effect.gen(function* fallsBack() {
      yield* Mailer.use((mailer) =>
        mailer.send({ ...message, sender: "personal" })
      );

      const body = yield* Schema.decodeUnknownEffect(BodySchema)(
        yield* Effect.promise(async () => (await requests[0]?.text()) ?? "")
      );

      assert.strictEqual(body.from, "Peal <noreply@example.test>");
    }).pipe(Effect.provide(layer));
  });

  it.effect.each([
    { retryable: true, status: 429 },
    { retryable: true, status: 503 },
    { retryable: false, status: 422 },
  ])("fails on $status, retryable: $retryable", ({ retryable, status }) =>
    Effect.gen(function* fails() {
      const failure = yield* Mailer.use((mailer) => mailer.send(message)).pipe(
        Effect.flip
      );

      assert.strictEqual(failure.retryable, retryable);
    }).pipe(Effect.provide(resendAnswering(status).layer))
  );
});
