import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { commandLineTokens, withCookies } from "#test/workspace/support.ts";

import {
  cookiesOf,
  emailsTo,
  emailTo,
  IntegrationLive,
  linkIn,
  newEmail,
  password,
  TestApp,
} from "./harness.ts";
import type { Reply } from "./harness.ts";

// A sign-up's answer, every field of its user kept.
const AnsweredUserSchema = Schema.Struct({
  user: Schema.Record(Schema.String, Schema.Unknown),
});

type AnsweredUser = typeof AnsweredUserSchema.Type.user;

const SignUpSchema = Schema.Struct({
  token: Schema.NullOr(Schema.String),
  user: Schema.Struct({
    email: Schema.String,
    emailVerified: Schema.Boolean,
    id: Schema.String,
    locale: Schema.String,
  }),
});

const SessionSchema = Schema.Struct({
  user: Schema.Struct({ email: Schema.String, emailVerified: Schema.Boolean }),
});

const ErrorSchema = Schema.Struct({ code: Schema.String });

const signUp = Effect.fn("signUp")(function* signUp(
  email: string,
  locale: "en" | "fr",
  {
    cookies = "",
    name = "Ada Lovelace",
    secret = password,
  }: {
    readonly cookies?: string;
    readonly name?: string;
    readonly secret?: string;
  } = {}
) {
  const app = yield* TestApp;

  return yield* app.request("/api/auth/sign-up/email", {
    body: {
      callbackURL: locale === "fr" ? "/fr/verify-email" : "/verify-email",
      email,
      locale,
      name,
      password: secret,
    },
    headers: cookies === "" ? {} : { cookie: cookies },
  });
});

const signIn = Effect.fn("signIn")(function* signIn(
  email: string,
  secret: string
) {
  const app = yield* TestApp;

  return yield* app.request("/api/auth/sign-in/email", {
    body: { email, password: secret },
  });
});

// Opens a link, in a browser holding these cookies (none: "").
const open = Effect.fn("open")(function* open(link: URL, cookies: string) {
  const app = yield* TestApp;

  return yield* app.request(`${link.pathname}${link.search}`, {
    headers: cookies === "" ? {} : { cookie: cookies },
  });
});

const decode = <S extends Schema.Top>(schema: S, reply: Reply) =>
  Schema.decodeUnknownEffect(schema)(reply.body).pipe(Effect.orDie);

// Version nibble of a UUID: 4 for random ids.
const versionOf = (id: string) => id.charAt(14);

// Whether a reply set a session cookie.
const setsSession = (reply: Reply): boolean =>
  reply.headers
    .getSetCookie()
    .some((cookie) => /^peal\.session_token=[^;]+/u.test(cookie));

// Whether a reply set the sign-up's browser nonce.
const setsNonce = (reply: Reply): boolean =>
  reply.headers
    .getSetCookie()
    .some((cookie) => /^peal\.sign_up_browser=[^;]+;.*HttpOnly/iu.test(cookie));

const confirmSubject = /^Confirm your email/u;

const StoredSchema = Schema.Array(
  Schema.Struct({
    email_verified: Schema.Boolean,
    name: Schema.String,
    passwords: Schema.Number,
    sessions: Schema.Number,
  })
);

// What the database holds of the address's account.
const storedOf = Effect.fn("storedOf")(function* storedOf(email: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql`
    SELECT u.email_verified, u.name,
      (SELECT count(*)::int FROM auth.account a
        WHERE a.user_id = u.id AND a.provider_id = 'credential'
          AND a.password IS NOT NULL) AS passwords,
      (SELECT count(*)::int FROM auth.session s
        WHERE s.user_id = u.id) AS sessions
    FROM auth."user" u WHERE u.email = ${email.toLowerCase()}`.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(StoredSchema)),
    Effect.orDie
  );

  const [row] = rows;

  assert.isDefined(row);

  return row;
});

// A password set through the reset flow, from the email it sends.
const resetPassword = Effect.fn("resetPassword")(function* resetPassword(
  email: string,
  newPassword: string
) {
  const app = yield* TestApp;

  const requested = yield* app.request("/api/auth/request-password-reset", {
    body: { email, redirectTo: "/reset-password" },
  });

  assert.strictEqual(requested.status, 200);

  const message = yield* emailTo(email, /^Reset your Peal password/u);
  const opened = yield* open(linkIn(message), "");

  const location = new URL(
    opened.headers.get("location") ?? "",
    "http://localhost:3001"
  );

  assert.strictEqual(opened.status, 302);
  assert.strictEqual(location.pathname, "/reset-password");

  const token = location.searchParams.get("token") ?? "";

  const reset = yield* app.request("/api/auth/reset-password", {
    body: { newPassword, token },
  });

  assert.strictEqual(reset.status, 200);

  return { message, token };
});

layer(IntegrationLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "signing up with an email and a password",
  (it) => {
    it.effect(
      "asks for the address to be confirmed, in the reader's language, before signing in",
      () =>
        Effect.gen(function* confirmsEmail() {
          const app = yield* TestApp;
          const email = newEmail("ada");

          const created = yield* signUp(email, "fr");

          assert.strictEqual(created.status, 200);
          assert.isTrue(setsNonce(created));

          const { token, user } = yield* decode(SignUpSchema, created);

          assert.isNull(token);
          assert.isFalse(user.emailVerified);
          assert.strictEqual(user.locale, "fr");
          assert.strictEqual(versionOf(user.id), "4");

          const early = yield* signIn(email, password);

          assert.strictEqual(early.status, 403);
          assert.strictEqual(
            (yield* decode(ErrorSchema, early)).code,
            "EMAIL_NOT_VERIFIED"
          );

          const message = yield* emailTo(email, /^Confirmez votre adresse/u);
          const link = linkIn(message);

          assert.strictEqual(link.pathname, "/api/auth/verify-email");
          assert.include(message.HTML, "Confirmer mon adresse");

          // In the browser that signed up, the link signs the reader in and
          // takes them to the page the web app asked for.
          const verified = yield* open(link, cookiesOf(created));

          assert.strictEqual(verified.status, 302);
          assert.strictEqual(
            verified.headers.get("location"),
            "/fr/verify-email"
          );
          // The nonce is spent.
          assert.include(
            verified.headers.getSetCookie().join("\n"),
            "peal.sign_up_browser=; Max-Age=0"
          );

          const session = yield* app.request("/api/auth/get-session", {
            headers: { cookie: cookiesOf(verified) },
          });

          assert.isTrue(
            (yield* decode(SessionSchema, session)).user.emailVerified
          );

          const signedIn = yield* signIn(email, password);

          assert.strictEqual(signedIn.status, 200);
          assert.include(cookiesOf(signedIn), "peal.session_token=");
          // The sign-in pages offer the way this browser used last first;
          // a refused sign-in says nothing of it.
          assert.include(cookiesOf(signedIn), "peal.last-sign-in=email");
          assert.notInclude(cookiesOf(early), "peal.last-sign-in");
        })
    );

    it.effect(
      "confirms the address from another browser without signing anyone in, and drops the password",
      () =>
        Effect.gen(function* elsewhere() {
          const email = newEmail("elsewhere");

          const created = yield* signUp(email, "en");

          // Another browser holds a nonce of its own, from another sign-up.
          const other = yield* signUp(newEmail("other-browser"), "en");
          const link = linkIn(yield* emailTo(email, confirmSubject));

          for (const cookies of ["", cookiesOf(other)]) {
            const opened = yield* open(link, cookies);

            assert.strictEqual(opened.status, 302);
            assert.isFalse(setsSession(opened));

            if (cookies === "") {
              assert.strictEqual(
                opened.headers.get("location"),
                "/verify-email?password=needed"
              );
            }
          }

          const stored = yield* storedOf(email);

          assert.isTrue(stored.email_verified);
          assert.strictEqual(stored.passwords, 0);
          assert.strictEqual(stored.sessions, 0);

          // The browser that signed up comes too late: the nonce was spent
          // with the password.
          assert.isFalse(setsSession(yield* open(link, cookiesOf(created))));
          assert.strictEqual((yield* signIn(email, password)).status, 401);

          // A password the address's owner sets then signs them in.
          const chosen = "a passphrase the owner chose";

          yield* resetPassword(email, chosen);

          assert.strictEqual((yield* signIn(email, chosen)).status, 200);
        })
    );

    it.effect(
      "keeps an account made with someone else's address from its owner's confirmation",
      () =>
        Effect.gen(function* preRegistered() {
          const victim = newEmail("victim");
          const attackerSecret = "the attacker's own passphrase";
          const victimSecret = "the owner's own passphrase";

          // Someone signs up with the owner's address, in their browser.
          const attacker = yield* signUp(victim, "en", {
            name: "Attacker",
            secret: attackerSecret,
          });

          // The owner signs up too, in theirs, and gets the same answer as
          // anyone, with a nonce of their own.
          const owner = yield* signUp(victim, "en", {
            name: "Owner",
            secret: victimSecret,
          });

          assert.strictEqual(owner.status, attacker.status);
          assert.isTrue(setsNonce(owner));
          assert.isNull((yield* decode(SignUpSchema, owner)).token);

          // The owner's sign-up took the account over: their name, and a
          // fresh link to the address.
          assert.strictEqual((yield* storedOf(victim)).name, "Owner");

          const [newest, first] = yield* emailsTo(victim, confirmSubject, 2);

          assert.isDefined(newest);
          assert.isDefined(first);

          // Either link, opened in the owner's browser, signs the owner in.
          const confirmed = yield* open(linkIn(first), cookiesOf(owner));

          assert.isTrue(setsSession(confirmed));

          // The attacker's password lets nobody in; the owner's does.
          assert.strictEqual(
            (yield* signIn(victim, attackerSecret)).status,
            401
          );
          assert.strictEqual((yield* signIn(victim, victimSecret)).status, 200);
        })
    );

    it.effect(
      "signs nobody in from a link opened in a browser that did not sign up",
      () =>
        Effect.gen(function* foreignLink() {
          // Someone signs up with their own address, and hands the owner of
          // another account the link, to have them work in theirs.
          const theirs = newEmail("lure");
          const lure = yield* signUp(theirs, "en");
          const target = yield* signUp(newEmail("target"), "en");

          const opened = yield* open(
            linkIn(yield* emailTo(theirs, confirmSubject)),
            cookiesOf(target)
          );

          assert.isFalse(setsSession(opened));
          assert.strictEqual((yield* storedOf(theirs)).passwords, 0);

          // The sign-up's own browser gets nothing back either.
          assert.strictEqual((yield* signIn(theirs, password)).status, 401);
          assert.isTrue(setsNonce(lure));
        })
    );

    it.effect(
      "ends the sessions and applications of an unconfirmed account taken over",
      () =>
        Effect.gen(function* takenOver() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const email = newEmail("taken-over");

          yield* signUp(email, "en", { name: "First" });

          // A session the account somehow holds, as one made before its
          // confirmation would be.
          const [user] = yield* sql<{
            readonly id: string;
          }>`SELECT id FROM auth."user" WHERE email = ${email.toLowerCase()}`.pipe(
            Effect.orDie
          );

          yield* sql`
            INSERT INTO auth.session (id, token, user_id, expires_at, created_at, updated_at)
            VALUES (gen_random_uuid(), ${`synthetic-session-${user?.id ?? ""}`}, ${user?.id ?? ""},
              now() + interval '1 day', now(), now())`.pipe(Effect.orDie);

          assert.strictEqual((yield* storedOf(email)).sessions, 1);

          const again = yield* signUp(email, "en", { name: "Second" });

          assert.strictEqual(again.status, 200);

          const stored = yield* storedOf(email);

          assert.strictEqual(stored.name, "Second");
          assert.strictEqual(stored.sessions, 0);
          assert.isFalse(stored.email_verified);

          // The resend route sends a link, which only the browser of the
          // last sign-up turns into a session.
          const resent = yield* app.request(
            "/api/auth/send-verification-email",
            {
              body: { callbackURL: "/verify-email", email },
            }
          );

          assert.strictEqual(resent.status, 200);

          const [link] = yield* emailsTo(email, confirmSubject, 3);

          assert.isDefined(link);
          assert.isTrue(
            setsSession(yield* open(linkIn(link), cookiesOf(again)))
          );
        })
    );

    it.effect("answers a sign-up for a known email like any other", () =>
      Effect.gen(function* knownEmail() {
        const email = newEmail("grace");

        const first = yield* signUp(email, "en");

        yield* open(
          linkIn(yield* emailTo(email, confirmSubject)),
          cookiesOf(first)
        );

        const again = yield* signUp(email, "en", {
          name: "Someone Else",
          secret: "a passphrase of someone else",
        });

        assert.strictEqual(again.status, first.status);
        // A nonce either way: the cookie tells nothing of the address.
        assert.isTrue(setsNonce(first));
        assert.isTrue(setsNonce(again));

        const original = yield* decode(SignUpSchema, first);
        const repeated = yield* decode(SignUpSchema, again);

        assert.notStrictEqual(repeated.user.id, original.user.id);
        assert.strictEqual(versionOf(repeated.user.id), "4");
        // Field for field, in the same order, with the same values but
        // those that name the account and when it was made: the plugins'
        // fields included (the admin plugin's, two-step verification's).
        const real = (yield* decode(AnsweredUserSchema, first)).user;
        const made = (yield* decode(AnsweredUserSchema, again)).user;

        assert.deepStrictEqual(Object.keys(made), Object.keys(real));

        const named = new Set([
          "createdAt",
          "email",
          "id",
          "name",
          "updatedAt",
        ]);

        const alike = (user: AnsweredUser) =>
          Object.entries(user).filter(([field]) => !named.has(field));

        assert.deepStrictEqual(alike(made), alike(real));
        assert.strictEqual(made["twoFactorEnabled"], false);

        // The confirmed account keeps its password and its name.
        assert.strictEqual((yield* signIn(email, password)).status, 200);
        assert.strictEqual(
          (yield* signIn(email, "a passphrase of someone else")).status,
          401
        );
        assert.strictEqual((yield* storedOf(email)).name, "Ada Lovelace");
      })
    );

    it.effect("signs out", () =>
      Effect.gen(function* signsOut() {
        const app = yield* TestApp;
        const email = newEmail("katherine");

        const created = yield* signUp(email, "en");

        const message = yield* emailTo(email, confirmSubject);
        const verified = yield* open(linkIn(message), cookiesOf(created));
        const cookie = cookiesOf(verified);

        const out = yield* app.request("/api/auth/sign-out", {
          body: {},
          headers: { cookie },
        });

        assert.strictEqual(out.status, 200);
        assert.include(
          out.headers.getSetCookie().join("\n"),
          "peal.session_token=; Max-Age=0"
        );

        // The session is gone. Cookies kept from before still carry a copy
        // of it, which reads may trust for up to five minutes.
        const after = yield* app.request(
          "/api/auth/get-session?disableCookieCache=true",
          { headers: { cookie } }
        );

        assert.isNull(after.body);
      })
    );

    it.effect(
      "resets a forgotten password through the emailed link, disconnecting the applications",
      () =>
        Effect.gen(function* resetsPassword() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const email = newEmail("hedy");
          const newPassword = "a much longer passphrase";

          const created = yield* signUp(email, "en");
          const confirmation = yield* emailTo(email, confirmSubject);

          const confirmed = yield* open(
            linkIn(confirmation),
            cookiesOf(created)
          );

          // The command line, signed in from that browser.
          const tokens = yield* commandLineTokens(
            withCookies(cookiesOf(created), confirmed)
          );

          const { message, token } = yield* resetPassword(email, newPassword);

          // The email says what a new password ends.
          assert.include(message.Text, "connected applications");

          assert.strictEqual((yield* signIn(email, password)).status, 401);
          assert.strictEqual((yield* signIn(email, newPassword)).status, 200);

          // The command line can no longer renew its access.
          const renewed = yield* app.request("/api/auth/oauth2/token", {
            form: {
              client_id: "peal-cli",
              grant_type: "refresh_token",
              refresh_token: tokens.refresh_token,
            },
          });

          assert.strictEqual(renewed.status, 400);

          const [kept] = yield* sql<{ readonly grants: number }>`
            SELECT
              (SELECT count(*)::int FROM auth.oauth_refresh_token r
                JOIN auth."user" u ON u.id = r.user_id
                WHERE u.email = ${email.toLowerCase()})
              + (SELECT count(*)::int FROM auth.oauth_consent c
                JOIN auth."user" u ON u.id = c.user_id
                WHERE u.email = ${email.toLowerCase()}) AS grants`.pipe(
            Effect.orDie
          );

          assert.strictEqual(kept?.grants, 0);

          const reused = yield* app.request("/api/auth/reset-password", {
            body: { newPassword: "yet another long passphrase", token },
          });

          assert.strictEqual(reused.status, 400);
        })
    );
  }
);
