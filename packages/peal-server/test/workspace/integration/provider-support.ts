// What the sign-in providers' tests share: a sign-in started as the web
// app's pages start one, the provider's answer through the fake, and the
// callback the browser then opens, with the cookies it holds.
import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import type { JsonValue } from "#test/channels/fakes/fake-http-server.ts";
import { FakeOidc } from "#test/workspace/fakes/fake-oidc.ts";
import type { Identity, Spoiled } from "#test/workspace/fakes/fake-oidc.ts";
import { withCookies } from "#test/workspace/support.ts";

import { bodyOf, origin, password, TestApp } from "./harness.ts";
import type { Reply } from "./harness.ts";

const StartedSchema = Schema.Struct({ url: Schema.String });

/** A sign-in the browser was sent to the provider for. */
export interface Started {
  readonly authorization: URL;
  readonly cookies: string;
  readonly nonce: string;
  readonly state: string;
}

/** Where the callback sent the browser, and what it holds then. */
export interface Finished {
  readonly cookies: string;
  /** The `error` the callback wrote into the address, if any. */
  readonly error: string | null;
  readonly location: URL;
  readonly reply: Reply;
}

/** What a test sends to start a sign-in. */
export type StartBody = Readonly<Record<string, JsonValue>>;

/** The body the sign-in page sends. */
export const signInPage = {
  callbackURL: "/after-sign-in",
  disableRedirect: true,
  errorCallbackURL: "/sign-in",
  provider: "oidc",
};

/** The body the sign-up page sends, in the page's language. */
export const signUpPage = (
  locale: "en" | "fr" = "en",
  invitation?: string
) => ({
  ...signInPage,
  additionalData:
    invitation === undefined ? { locale } : { invitation, locale },
  errorCallbackURL: "/sign-up",
  newUserCallbackURL: "/welcome",
  requestSignUp: true,
});

export const startSignIn = Effect.fn("startSignIn")(function* startSignIn(
  body: StartBody = signInPage,
  given?: string
) {
  const app = yield* TestApp;
  const cookies = given ?? "";

  const reply = yield* app.request("/api/auth/sign-in/social", {
    body,
    headers: cookies === "" ? {} : { cookie: cookies },
  });

  if (reply.status !== 200) {
    return yield* Effect.die(
      new Error(`The sign-in answered ${String(reply.status)}`)
    );
  }

  const authorization = new URL((yield* bodyOf(StartedSchema, reply)).url);

  const started: Started = {
    authorization,
    cookies: withCookies(cookies, reply),
    nonce: authorization.searchParams.get("nonce") ?? "",
    state: authorization.searchParams.get("state") ?? "",
  };

  return started;
});

export const finishSignIn = Effect.fn("finishSignIn")(function* finishSignIn(
  started: Started,
  code: string,
  cookies: string = started.cookies
) {
  const app = yield* TestApp;
  const query = new URLSearchParams({ code, state: started.state });

  const reply = yield* app.request(
    `/api/auth/callback/oidc?${query.toString()}`,
    {
      // As a browser opens the address the provider sends it back to.
      headers:
        cookies === ""
          ? { accept: "text/html", "sec-fetch-mode": "navigate" }
          : {
              accept: "text/html",
              cookie: cookies,
              "sec-fetch-mode": "navigate",
            },
    }
  );

  const location = new URL(reply.headers.get("location") ?? "/", origin);

  const finished: Finished = {
    cookies: withCookies(cookies, reply),
    error: location.searchParams.get("error"),
    location,
    reply,
  };

  return finished;
});

/** A sign-in through the fake provider, from its start to its callback. */
export const providerSignIn = Effect.fn("providerSignIn")(
  function* providerSignIn(
    identity: Identity,
    options: {
      readonly body?: StartBody;
      readonly spoiled?: Spoiled;
    } = {}
  ) {
    const provider = yield* FakeOidc;
    const started = yield* startSignIn(options.body ?? signInPage);

    const code = yield* provider.issue(
      identity,
      started.nonce,
      options.spoiled
    );

    return yield* finishSignIn(started, code);
  }
);

/** Whether a reply set a session cookie. */
export const setsSession = (reply: Reply): boolean =>
  reply.headers
    .getSetCookie()
    .some((cookie) => /^peal\.session_token=[^;]+/u.test(cookie));

/** A subject the fake provider has never named. */
export const newSubject = (): string => `synthetic-subject-${randomUUID()}`;

/** A verified identity for an address. */
export const verified = (email: string, sub = newSubject()): Identity => ({
  email,
  email_verified: true,
  name: "Synthetic Person",
  sub,
});

const RowsSchema = Schema.Array(
  Schema.Struct({
    accounts: Schema.Number,
    email_verified: Schema.Boolean,
    id: Schema.String,
    locale: Schema.NullOr(Schema.String),
    name: Schema.String,
    sessions: Schema.Number,
  })
);

/** What the database holds for an address: the user, its links, sessions. */
export const accountOf = Effect.fn("accountOf")(function* accountOf(
  email: string
) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql`
    SELECT
      u.id, u.name, u.email_verified, u.locale,
      (SELECT count(*)::int FROM auth.account a
        WHERE a.user_id = u.id AND a.provider_id = 'oidc') AS accounts,
      (SELECT count(*)::int FROM auth.session s
        WHERE s.user_id = u.id) AS sessions
    FROM auth."user" u
    WHERE u.email = ${email.toLowerCase()}`.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(RowsSchema)),
    Effect.orDie
  );

  return rows[0];
});

/** The users the provider's subject is linked to. */
export const ownersOf = Effect.fn("ownersOf")(function* ownersOf(
  subject: string
) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly user_id: string }>`
    SELECT user_id FROM auth.account
    WHERE provider_id = 'oidc' AND account_id = ${subject}`.pipe(Effect.orDie);

  return rows.map(({ user_id: userId }) => userId);
});

/**
 * An account with a password, written as Better Auth writes one, straight
 * in the database, its address confirmed or not.
 */
export const existingAccount = Effect.fn("existingAccount")(
  function* existingAccount(
    email: string,
    {
      banned = false,
      confirmed = true,
      twoStep = false,
    }: {
      readonly banned?: boolean;
      readonly confirmed?: boolean;
      readonly twoStep?: boolean;
    } = {}
  ) {
    const sql = yield* SqlClient.SqlClient;
    const id = randomUUID();

    yield* sql`
      INSERT INTO auth."user"
        (id, name, email, email_verified, banned, two_factor_enabled, locale, created_at, updated_at)
      VALUES
        (${id}, 'Existing Person', ${email.toLowerCase()}, ${confirmed}, ${banned}, ${twoStep}, 'fr', now(), now())`.pipe(
      Effect.orDie
    );

    return id;
  }
);

const SessionSchema = Schema.Struct({
  user: Schema.Struct({ email: Schema.String, id: Schema.String }),
});

/** Who the cookies sign in, as Better Auth answers. */
export const sessionUser = Effect.fn("sessionUser")(function* sessionUser(
  cookies: string
) {
  const app = yield* TestApp;

  const reply = yield* app.request("/api/auth/get-session", {
    headers: { cookie: cookies },
  });

  return (yield* bodyOf(SessionSchema, reply)).user;
});

export { password };
