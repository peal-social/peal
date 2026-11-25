// A new account's welcome through the server's own composition: its contexts
// and its workers (ContextsLive, WorkersLive), with the real renderer and
// readers, on Postgres, sending to Mailpit. Only the cluster's runner and the
// clock are the test's: the jobs' messages are Postgres rows, and TestClock
// says when they are due. It fails if the workflow is not registered.
import { randomUUID } from "node:crypto";

import { assert, describe, it } from "@effect/vitest";
import {
  Clock,
  ConfigProvider,
  Duration,
  Effect,
  Layer,
  Schedule,
  Schema,
} from "effect";
import { ShardingConfig, SqlMessageStorage } from "effect/cluster";
import { Digest } from "effect/crypto";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { ProductAnalyticsLive } from "#app/product-analytics.ts";
import { ContextsLive, WorkersLive } from "#app/server.ts";
import { DatabaseLive } from "#shared/infrastructure/database.ts";
import { MigrationsLive } from "#shared/infrastructure/migrations.ts";
import { storageSettings } from "#test/media/support.ts";
import {
  clusterOver,
  eventuallyNow,
  settle,
} from "#test/publishing/infrastructure/harness.ts";
import { ownDatabase } from "#test/shared/own-database.ts";
import {
  linkIn,
  MailpitMessageSchema,
  origin,
  password,
} from "#test/workspace/integration/harness.ts";
import { BetterAuth } from "#workspace/infrastructure/auth/better-auth.ts";

const personalFrom = { Address: "ada@example.test", Name: "Ada at Synthetic" };

// The jobs' rows, in tables of the test's own.
const Storage = SqlMessageStorage.layerWith({ prefix: "test_welcome" }).pipe(
  Layer.provide([ShardingConfig.layer(), Digest.layerWebCrypto])
);

// On a database of its own, as the server's crons reach every row of theirs.
const Server = WorkersLive.pipe(
  Layer.provideMerge(ContextsLive),
  Layer.provideMerge(ProductAnalyticsLive),
  Layer.provide(storageSettings),
  Layer.provideMerge(clusterOver(Storage)),
  Layer.provideMerge(MigrationsLive),
  Layer.provideMerge(DatabaseLive),
  Layer.provide(
    ConfigProvider.layerAdd(
      ConfigProvider.fromUnknown({
        MAIL_FROM: "Synthetic <noreply@example.test>",
        PEAL_MAIL_PERSONAL_FROM: `${personalFrom.Name} <${personalFrom.Address}>`,
        PEAL_MAIL_WELCOME_SIGNER: "Ada Synthetic",
        PEAL_S3_KEY_PREFIX: "tests/welcome/",
      }),
      { asPrimary: true }
    )
  ),
  Layer.provide(ownDatabase("welcome"))
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

const mailpit = process.env["MAILPIT_URL"] ?? "http://127.0.0.1:18025";

const read = <S extends Schema.Top>(path: string, schema: S) =>
  Effect.promise(async () => {
    const response = await fetch(`${mailpit}/api/v1/${path}`);
    const json: unknown = await response.json();

    return json;
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(schema)), Effect.orDie);

const emailsTo = (address: string) =>
  read(
    `search?${new URLSearchParams({ query: `to:"${address}"` }).toString()}`,
    SearchSchema
  ).pipe(Effect.map(({ messages }) => messages));

const welcomesTo = (address: string) =>
  emailsTo(address).pipe(
    Effect.map((emails) =>
      emails.filter(({ Subject }) => Subject === "Bienvenue sur Peal")
    )
  );

const post = (
  path: string,
  body: Readonly<Record<string, string>>,
  cookie = ""
) =>
  BetterAuth.use((auth) =>
    Effect.promise(
      async () =>
        await auth.handler(
          new Request(`${origin}/api/auth${path}`, {
            body: JSON.stringify(body),
            headers: {
              "content-type": "application/json",
              cookie,
              origin,
            },
            method: "POST",
          })
        )
    )
  );

// Signs up, then confirms the address from its email, as the web app does.
const confirmedAccount = Effect.fn("confirmedAccount")(
  function* confirmedAccount(email: string) {
    const created = yield* post("/sign-up/email", {
      email,
      locale: "fr",
      name: "Grace Synthetic",
      password,
    });

    assert.strictEqual(created.status, 200);

    const [confirmation] = yield* emailsTo(email).pipe(
      Effect.repeat({
        schedule: Schedule.spaced("100 millis"),
        times: 100,
        until: (emails) => emails.length > 0,
      }),
      TestClock.withLive
    );

    const message = yield* read(
      `message/${confirmation?.ID ?? ""}`,
      MailpitMessageSchema
    );

    const confirmed = yield* post(
      "/confirm-email",
      {
        intent: "auto",
        token: linkIn(message).searchParams.get("token") ?? "",
      },
      created.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0] ?? "")
        .join("; ")
    );

    assert.strictEqual(confirmed.status, 200);
  }
);

const CountSchema = Schema.Tuple([Schema.Struct({ count: Schema.Int })]);

// The welcomes' runs the cluster holds.
const runs = SqlClient.SqlClient.use(
  (sql) =>
    sql`SELECT count(*)::int AS count FROM test_welcome_messages WHERE entity_type = 'Workflow/WelcomeV1' AND tag = 'run'`
).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(CountSchema)),
  Effect.map(([{ count }]) => count),
  Effect.orDie
);

// The server waits up to ten seconds of the test's clock for the work Better
// Auth started: a failure lets that pass, so it is the one reported.
const lettingGo = TestClock.withLive(Effect.sleep("1 second")).pipe(
  Effect.andThen(TestClock.adjust("1 minute")),
  Effect.forkDetach
);

describe("a new account's welcome, through the server", () => {
  it.effect(
    "goes once, from the person who signs it, five minutes after the account was made",
    () =>
      Effect.gen(function* welcomed() {
        // Better Auth and Postgres keep the real time.
        yield* TestClock.setTime(
          yield* TestClock.withLive(Clock.currentTimeMillis)
        );

        yield* Effect.gen(function* running() {
          const email = `welcome+${randomUUID()}@example.test`;
          const before = yield* runs;

          yield* confirmedAccount(email);

          yield* eventuallyNow(
            "the welcome was started",
            runs.pipe(Effect.map((count) => count === before + 1))
          );
          yield* settle();

          yield* TestClock.adjust(Duration.seconds(290));
          yield* settle();

          assert.deepStrictEqual(yield* welcomesTo(email), []);

          yield* TestClock.adjust(Duration.seconds(15));

          yield* eventuallyNow(
            "the welcome was sent",
            welcomesTo(email).pipe(Effect.map(({ length }) => length > 0))
          );

          // Nor at the next check.
          yield* TestClock.adjust(Duration.minutes(16));
          yield* settle();

          const [welcome, ...more] = yield* welcomesTo(email);

          assert.deepStrictEqual(more, []);
          assert.deepStrictEqual(welcome?.From, personalFrom);

          const { HTML, Text } = yield* read(
            `message/${welcome?.ID ?? ""}`,
            MailpitMessageSchema
          );

          assert.include(Text, "je m’appelle Ada Synthetic");
          assert.include(HTML, "/api/email-assets/header.gif");
          assert.strictEqual(
            /https?:\/\/\S+/u.exec(Text)?.[0],
            `${origin}/fr/`
          );
        }).pipe(
          Effect.onError(() => lettingGo),
          Effect.provide(Server)
        );
      }),
    120_000
  );
});
