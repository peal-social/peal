// Signing in and up through an OpenID Connect provider, against a fake one
// on a loopback port: a provider's identity reaches an account only through
// an address both sides confirmed, its ID token is checked, two-step
// verification sends the account to its password, and the server keeps
// none of the provider's tokens.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { CaptchaSchema } from "peal-contract";

import { mcpResource, registeredClient } from "#test/app/mcp-support.ts";
import {
  appWithGoogle,
  appWithOidc,
  FakeOidc,
} from "#test/workspace/fakes/fake-oidc.ts";
import { enrolled } from "#test/workspace/support.ts";

import {
  emailTo,
  linkIn,
  MigratedSqlLive,
  newEmail,
  origin,
  password,
  signIn,
  TestApp,
  workspaceOf,
} from "./harness.ts";
import {
  accountOf,
  existingAccount,
  finishSignIn,
  newSubject,
  ownersOf,
  providerSignIn,
  sessionUser,
  setsSession,
  signInPage,
  signUpPage,
  startSignIn,
  verified,
} from "./provider-support.ts";

const settings = { timeout: "180 seconds" } as const;

const MeSchema = Schema.Struct({
  user: Schema.Struct({ hasPassword: Schema.optionalKey(Schema.Boolean) }),
});

const hasPasswordOf = Effect.fn("hasPasswordOf")(function* hasPasswordOf(
  cookies: string
) {
  const app = yield* TestApp;
  const reply = yield* app.request("/api/me", { headers: { cookie: cookies } });

  return Schema.decodeUnknownSync(MeSchema)(reply.body).user.hasPassword;
});

// A password set through the reset flow, from the email it sends.
const setPassword = Effect.fn("setPassword")(function* setPassword(
  email: string
) {
  const app = yield* TestApp;

  const requested = yield* app.request("/api/auth/request-password-reset", {
    body: { email, redirectTo: "/reset-password" },
  });

  assert.strictEqual(requested.status, 200);

  const link = linkIn(yield* emailTo(email, /^Reset your Peal password/u));
  const opened = yield* app.request(`${link.pathname}${link.search}`);

  const token =
    new URL(opened.headers.get("location") ?? "", origin).searchParams.get(
      "token"
    ) ?? "";

  const reset = yield* app.request("/api/auth/reset-password", {
    body: { newPassword: password, token },
  });

  assert.strictEqual(reset.status, 200);
});

const ExportSchema = Schema.Struct({
  signInMethods: Schema.Array(Schema.Struct({ provider: Schema.String })),
});

const HoldSchema = Schema.Array(
  Schema.Struct({
    sign_in_methods: Schema.Array(
      Schema.Struct({ accountId: Schema.String, provider: Schema.String })
    ),
  })
);

const ErrorSchema = Schema.Struct({ code: Schema.String });

const tokenColumnsOf = Effect.fn("tokenColumnsOf")(function* tokenColumnsOf(
  subject: string
) {
  const sql = yield* SqlClient.SqlClient;

  return yield* sql<{ readonly kept: number }>`
    SELECT count(*)::int AS kept FROM auth.account
    WHERE provider_id = 'oidc' AND account_id = ${subject}
      AND (access_token IS NOT NULL OR refresh_token IS NOT NULL
        OR id_token IS NOT NULL OR access_token_expires_at IS NOT NULL
        OR refresh_token_expires_at IS NOT NULL OR scope IS NOT NULL)`.pipe(
    Effect.map((rows) => rows[0]?.kept ?? 0),
    Effect.orDie
  );
});

layer(Layer.mergeAll(appWithOidc(), MigratedSqlLive), settings)(
  "signing in through an OpenID Connect provider",
  (it) => {
    it.effect("tells the pages which provider the server offers", () =>
      Effect.gen(function* lists() {
        const app = yield* TestApp;
        const reply = yield* app.request("/api/captcha");

        assert.deepStrictEqual(
          Schema.decodeUnknownSync(CaptchaSchema)(reply.body).signInProviders,
          [{ id: "oidc", name: "Synthetic directory" }]
        );
      })
    );

    it.effect(
      "refuses an address the provider did not confirm, writing nothing",
      () =>
        Effect.gen(function* unconfirmed() {
          for (const claim of [false, "false", undefined]) {
            const email = newEmail("unconfirmed");

            const identity = {
              ...verified(email),
              email_verified: claim,
            };

            const finished = yield* providerSignIn(identity, {
              body: signUpPage(),
            });

            assert.strictEqual(finished.error, "provider_email_unverified");
            assert.strictEqual(finished.location.pathname, "/sign-up");
            assert.isFalse(setsSession(finished.reply));
            assert.isUndefined(yield* accountOf(email));
            assert.deepStrictEqual(yield* ownersOf(identity.sub), []);
          }
        })
    );

    it.effect(
      "links no unconfirmed address to an account that confirmed it",
      () =>
        Effect.gen(function* unconfirmedMatch() {
          const email = newEmail("taken");

          yield* existingAccount(email);

          const identity = { ...verified(email), email_verified: false };
          const finished = yield* providerSignIn(identity);

          // Better Auth refuses before Peal's admission is asked, with its
          // own code: nothing is linked, and nobody is signed in.
          assert.strictEqual(finished.error, "account_not_linked");
          assert.isFalse(setsSession(finished.reply));
          assert.deepStrictEqual(yield* ownersOf(identity.sub), []);
          assert.strictEqual((yield* accountOf(email))?.sessions, 0);
        })
    );

    it.effect(
      "links a confirmed address to the account that confirmed it, changing nothing of it",
      () =>
        Effect.gen(function* links() {
          const email = newEmail("linked");
          const id = yield* existingAccount(email);
          const identity = { ...verified(email.toUpperCase()), name: "Other" };

          const finished = yield* providerSignIn(identity);

          assert.isNull(finished.error);
          assert.strictEqual(finished.location.pathname, "/after-sign-in");
          assert.strictEqual((yield* sessionUser(finished.cookies)).id, id);
          assert.deepStrictEqual(yield* ownersOf(identity.sub), [id]);

          const account = yield* accountOf(email);

          assert.strictEqual(account?.name, "Existing Person");
          assert.strictEqual(account?.locale, "fr");
        })
    );

    it.effect(
      "links nothing to an account that never confirmed its address",
      () =>
        Effect.gen(function* preRegistered() {
          const email = newEmail("pre-registered");

          yield* existingAccount(email, { confirmed: false });

          const identity = verified(email);
          const finished = yield* providerSignIn(identity);

          assert.strictEqual(finished.error, "account_not_linked");
          assert.isFalse(setsSession(finished.reply));
          assert.deepStrictEqual(yield* ownersOf(identity.sub), []);

          const account = yield* accountOf(email);

          assert.isFalse(account?.email_verified);
          assert.strictEqual(account?.sessions, 0);
        })
    );

    it.effect("refuses a provider that gives no address", () =>
      Effect.gen(function* noAddress() {
        const sub = newSubject();

        const finished = yield* providerSignIn(
          { email_verified: true, name: "No Address", sub },
          { body: signUpPage() }
        );

        assert.strictEqual(finished.error, "email_not_found");
        assert.isFalse(setsSession(finished.reply));
        assert.deepStrictEqual(yield* ownersOf(sub), []);
      })
    );

    it.effect(
      "signs in the account a subject is linked to, whatever address it now gives",
      () =>
        Effect.gen(function* sameSubject() {
          const first = newEmail("first");
          const second = newEmail("second");
          const firstId = yield* existingAccount(first);

          yield* existingAccount(second);

          const sub = newSubject();

          assert.isNull((yield* providerSignIn(verified(first, sub))).error);

          const moved = yield* providerSignIn(verified(second, sub));

          assert.isNull(moved.error);
          assert.strictEqual((yield* sessionUser(moved.cookies)).id, firstId);
          assert.deepStrictEqual(yield* ownersOf(sub), [firstId]);
        })
    );

    it.effect(
      "links a second subject with the same address to the same account",
      () =>
        Effect.gen(function* secondSubject() {
          const email = newEmail("two-subjects");
          const id = yield* existingAccount(email);
          const one = newSubject();
          const two = newSubject();

          assert.isNull((yield* providerSignIn(verified(email, one))).error);
          assert.isNull((yield* providerSignIn(verified(email, two))).error);
          assert.deepStrictEqual(yield* ownersOf(one), [id]);
          assert.deepStrictEqual(yield* ownersOf(two), [id]);
          assert.strictEqual((yield* accountOf(email))?.accounts, 2);
        })
    );

    it.effect("refuses an ID token the provider did not sign for Peal", () =>
      Effect.gen(function* spoiledTokens() {
        for (const spoiled of [
          { foreignKey: true },
          { audience: "another-client" },
          { issuer: "http://127.0.0.1:1" },
          { nonce: null },
          { nonce: "another-nonce" },
          { withoutIdToken: true },
        ]) {
          const email = newEmail("spoiled");

          const finished = yield* providerSignIn(verified(email), {
            body: signUpPage(),
            spoiled,
          });

          assert.isNotNull(finished.error, JSON.stringify(spoiled));
          assert.isFalse(setsSession(finished.reply));
          assert.isUndefined(yield* accountOf(email));
        }
      })
    );

    it.effect("refuses a callback in a browser that did not start it", () =>
      Effect.gen(function* otherBrowser() {
        const provider = yield* FakeOidc;
        const email = newEmail("other-browser");
        const started = yield* startSignIn(signUpPage());
        const code = yield* provider.issue(verified(email), started.nonce);

        const finished = yield* finishSignIn(started, code, "");

        assert.isNotNull(finished.error);
        assert.isFalse(setsSession(finished.reply));
        assert.isUndefined(yield* accountOf(email));
      })
    );

    it.effect("refuses a start that asks for more than the pages do", () =>
      Effect.gen(function* fields() {
        const app = yield* TestApp;

        // With a key the route drops, of any value, beside them too.
        for (const oddity of [
          {},
          ...[0, false, null, { x: 1 }].map((value) => ({
            oauth_query: value,
          })),
        ]) {
          for (const extra of [
            { idToken: { token: "synthetic.id.token" } },
            { scopes: ["offline_access"] },
            { additionalParams: { prompt: "none" } },
            { loginHint: "someone@example.test" },
            { additionalData: { next: "/elsewhere" } },
          ]) {
            const reply = yield* app.request("/api/auth/sign-in/social", {
              body: { ...signInPage, ...extra, ...oddity },
            });

            assert.strictEqual(
              reply.status,
              400,
              JSON.stringify({ ...extra, ...oddity })
            );
            assert.strictEqual(
              Schema.decodeUnknownSync(ErrorSchema)(reply.body).code,
              "PROVIDER_SIGN_IN_FIELD_NOT_ALLOWED"
            );
          }
        }

        for (const address of [
          { callbackURL: "https://elsewhere.example.test/" },
          { errorCallbackURL: "https://elsewhere.example.test/" },
          { newUserCallbackURL: "https://elsewhere.example.test/" },
        ]) {
          const reply = yield* app.request("/api/auth/sign-in/social", {
            body: { ...signInPage, ...address },
          });

          assert.strictEqual(reply.status, 403, JSON.stringify(address));
        }

        const own = yield* app.request("/api/auth/sign-in/social", {
          body: { ...signInPage, callbackURL: `${origin}/after-sign-in` },
        });

        assert.strictEqual(own.status, 200);
      })
    );

    it.effect("keeps none of the provider's tokens", () =>
      Effect.gen(function* noTokens() {
        const email = newEmail("no-tokens");
        const sub = newSubject();

        const signedUp = yield* providerSignIn(verified(email, sub), {
          body: signUpPage(),
        });

        assert.isNull(signedUp.error);
        assert.strictEqual(yield* tokenColumnsOf(sub), 0);

        assert.isNull((yield* providerSignIn(verified(email, sub))).error);
        assert.strictEqual(yield* tokenColumnsOf(sub), 0);

        const linkedEmail = newEmail("linked-no-tokens");
        const linkedSub = newSubject();

        yield* existingAccount(linkedEmail);

        assert.isNull(
          (yield* providerSignIn(verified(linkedEmail, linkedSub))).error
        );
        assert.strictEqual(yield* tokenColumnsOf(linkedSub), 0);
      })
    );

    it.effect(
      "sends an account with two-step verification to its password",
      () =>
        Effect.gen(function* twoStep() {
          const email = newEmail("two-step");
          const id = yield* existingAccount(email);
          const sub = newSubject();

          assert.isNull((yield* providerSignIn(verified(email, sub))).error);

          const sql = yield* SqlClient.SqlClient;

          yield* sql`
            UPDATE auth."user" SET two_factor_enabled = true WHERE id = ${id}`.pipe(
            Effect.orDie
          );
          yield* sql`DELETE FROM auth.session WHERE user_id = ${id}`.pipe(
            Effect.orDie
          );

          const linked = yield* providerSignIn(verified(email, sub));

          assert.strictEqual(linked.error, "two_step_password");
          assert.isFalse(setsSession(linked.reply));
          assert.strictEqual((yield* accountOf(email))?.sessions, 0);

          const otherEmail = newEmail("two-step-unlinked");
          const otherSub = newSubject();

          yield* existingAccount(otherEmail, { twoStep: true });

          const unlinked = yield* providerSignIn(
            verified(otherEmail, otherSub)
          );

          assert.strictEqual(unlinked.error, "two_step_password");
          assert.isFalse(setsSession(unlinked.reply));
          assert.deepStrictEqual(yield* ownersOf(otherSub), []);
        })
    );

    it.effect(
      "makes an account only from the sign-up page, in its language",
      () =>
        Effect.gen(function* signUp() {
          const stranger = newEmail("stranger");
          const strangerSub = newSubject();

          const refused = yield* providerSignIn(
            verified(stranger, strangerSub)
          );

          assert.strictEqual(refused.error, "signup_disabled");
          assert.isUndefined(yield* accountOf(stranger));
          assert.deepStrictEqual(yield* ownersOf(strangerSub), []);

          const email = newEmail("newcomer");
          const sub = newSubject();

          const created = yield* providerSignIn(
            { ...verified(email, sub), name: "  New\u0000comer " },
            { body: signUpPage("fr") }
          );

          assert.isNull(created.error);
          assert.strictEqual(created.location.pathname, "/welcome");
          assert.isTrue(setsSession(created.reply));

          const account = yield* accountOf(email);

          assert.isTrue(account?.email_verified);
          assert.strictEqual(account?.locale, "fr");
          assert.strictEqual(account?.name, "Newcomer");
          assert.deepStrictEqual(yield* ownersOf(sub), [account?.id]);
        })
    );

    it.effect("never signs a banned account in", () =>
      Effect.gen(function* banned() {
        const email = newEmail("banned");
        const sub = newSubject();

        yield* existingAccount(email, { banned: true });

        const finished = yield* providerSignIn(verified(email, sub));

        assert.isNotNull(finished.error);
        assert.isFalse(setsSession(finished.reply));
        assert.deepStrictEqual(yield* ownersOf(sub), []);
        assert.strictEqual((yield* accountOf(email))?.sessions, 0);
      })
    );
  }
);

// The reset's email is waited for on the real clock. The server keeps what
// French law has a host keep of a closed account, as Peal's servers do.
layer(
  Layer.mergeAll(
    appWithOidc({ PEAL_LEGAL_RETENTION: "true" }),
    MigratedSqlLive
  ),
  {
    ...settings,
    excludeTestServices: true,
  }
)("an account made through an OpenID Connect provider", (it) => {
  it.effect(
    "has no password until a reset sets one, and then signs in with its code",
    () =>
      Effect.gen(function* passwordLater() {
        const app = yield* TestApp;
        const email = newEmail("provider-made");
        const sub = newSubject();

        const created = yield* providerSignIn(verified(email, sub), {
          body: signUpPage(),
        });

        assert.isNull(created.error);
        assert.isFalse(yield* hasPasswordOf(created.cookies));

        // Closing the account asks for a password it does not have.
        const close = yield* app.request("/api/me", {
          body: { password: "a password it never had" },
          headers: { cookie: created.cookies },
          method: "DELETE",
        });

        assert.strictEqual(close.status, 400);

        const exported = yield* app.request("/api/me/export", {
          headers: { cookie: created.cookies },
        });

        assert.deepStrictEqual(
          Schema.decodeUnknownSync(ExportSchema)(exported.body).signInMethods,
          [{ provider: "oidc" }]
        );

        yield* setPassword(email);

        const cookies = yield* signIn(email);

        assert.isTrue(yield* hasPasswordOf(cookies));

        yield* enrolled({ cookies, email, id: "" });

        const refused = yield* providerSignIn(verified(email, sub));

        assert.strictEqual(refused.error, "two_step_password");
        assert.isFalse(setsSession(refused.reply));
      })
  );

  it.effect(
    "closes with the password it set, its provider's id kept as French law asks",
    () =>
      Effect.gen(function* closes() {
        const app = yield* TestApp;
        const email = newEmail("provider-closed");
        const sub = newSubject();

        const created = yield* providerSignIn(verified(email, sub), {
          body: signUpPage(),
        });

        const id = (yield* accountOf(email))?.id ?? "";

        yield* setPassword(email);

        const cookies = yield* signIn(email);

        assert.isNull(created.error);

        const closed = yield* app.request("/api/me", {
          body: { password },
          headers: { cookie: cookies },
          method: "DELETE",
        });

        assert.strictEqual(closed.status, 204);
        assert.isUndefined(yield* accountOf(email));
        assert.deepStrictEqual(yield* ownersOf(sub), []);

        const sql = yield* SqlClient.SqlClient;

        const holds = yield* sql`
            SELECT sign_in_methods FROM legal.identification_holds
            WHERE user_id = ${id}`.pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(HoldSchema)),
          Effect.orDie
        );

        assert.deepStrictEqual(
          holds[0]?.sign_in_methods
            .map(({ accountId, provider }) => `${provider}:${accountId}`)
            .toSorted(),
          [`oidc:${sub}`, `credential:${id}`].toSorted()
        );
      })
  );
});

// An MCP client's authorization waits at the sign-in page, whose signed
// query the sign-in carries in its state: once the provider's callback
// signs the person in, the authorization goes on to the workspace picker.
layer(
  Layer.mergeAll(
    appWithOidc({ MCP_DYNAMIC_REGISTRATION: "true" }),
    MigratedSqlLive
  ),
  settings
)("an MCP client's authorization through a provider", (it) => {
  it.effect("goes on to the workspace picker after the callback", () =>
    Effect.gen(function* resumes() {
      const app = yield* TestApp;
      const provider = yield* FakeOidc;
      const email = newEmail("mcp-provider");
      const sub = newSubject();

      const created = yield* providerSignIn(verified(email, sub), {
        body: signUpPage(),
      });

      yield* workspaceOf(
        { cookies: created.cookies, email, id: "" },
        "Provider Notes"
      );

      const clientId = yield* registeredClient;

      const query = new URLSearchParams({
        client_id: clientId,
        code_challenge: "synthetic-challenge-0123456789abcdefghijklmnopqrstu",
        code_challenge_method: "S256",
        redirect_uri: "http://127.0.0.1:33418/callback",
        resource: mcpResource,
        response_type: "code",
        scope: "workspace:read",
        state: "mcp-provider",
      });

      const authorization = yield* app.request(
        `/api/auth/oauth2/authorize?${query.toString()}`
      );

      const signInPageUrl = new URL(
        authorization.headers.get("location") ?? "",
        origin
      );

      assert.strictEqual(signInPageUrl.pathname, "/sign-in");

      const started = yield* startSignIn({
        ...signInPage,
        oauth_query: signInPageUrl.search.slice(1),
      });

      const code = yield* provider.issue(verified(email, sub), started.nonce);
      const finished = yield* finishSignIn(started, code);

      assert.isNull(finished.error);
      assert.strictEqual(finished.location.pathname, "/oauth/workspace");
      assert.strictEqual(
        finished.location.searchParams.get("client_id"),
        clientId
      );
    })
  );
});

// Google vouches for a Gmail address, or one of a domain Google Workspace
// manages (`hd`): any other address it once confirmed may have changed
// hands since, so it reaches no account and makes none.
layer(Layer.mergeAll(appWithGoogle(), MigratedSqlLive), settings)(
  "signing in with Google",
  (it) => {
    const googleSignIn = { ...signInPage, provider: "google" };
    const googleSignUp = { ...signUpPage(), provider: "google" };

    it.effect(
      "joins no account to an address Google is not the authority for",
      () =>
        Effect.gen(function* notAuthoritative() {
          const email = `marketing-${newSubject()}@corp.example`;

          yield* existingAccount(email);

          const identity = verified(email);

          const finished = yield* providerSignIn(identity, {
            body: googleSignIn,
          });

          assert.strictEqual(
            finished.error,
            "provider_email_not_authoritative"
          );
          assert.isFalse(setsSession(finished.reply));
          assert.deepStrictEqual(yield* ownersOf(identity.sub, "google"), []);
          assert.strictEqual((yield* accountOf(email))?.sessions, 0);

          const stranger = `stranger-${newSubject()}@corp.example`;

          const signedUp = yield* providerSignIn(verified(stranger), {
            body: googleSignUp,
          });

          assert.strictEqual(
            signedUp.error,
            "provider_email_not_authoritative"
          );
          assert.isUndefined(yield* accountOf(stranger));
        })
    );

    it.effect("joins the account of an address Google Workspace manages", () =>
      Effect.gen(function* workspaceDomain() {
        const email = `ada-${newSubject()}@corp.example`;
        const id = yield* existingAccount(email);
        const identity = { ...verified(email), hd: "corp.example" };

        const finished = yield* providerSignIn(identity, {
          body: googleSignIn,
        });

        assert.isNull(finished.error);
        assert.deepStrictEqual(yield* ownersOf(identity.sub, "google"), [id]);
      })
    );

    it.effect("makes an account for a Gmail address", () =>
      Effect.gen(function* gmail() {
        const email = `synthetic.${newSubject()}@gmail.com`;

        const finished = yield* providerSignIn(verified(email), {
          body: googleSignUp,
        });

        assert.isNull(finished.error);
        assert.isTrue((yield* accountOf(email))?.email_verified);
      })
    );
  }
);
