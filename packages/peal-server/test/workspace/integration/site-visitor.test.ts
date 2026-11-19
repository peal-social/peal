// A visitor the site, the docs and the blog followed, once they allowed
// it, is linked to the account they make in that browser, once, at the
// sign-up: the server sends PostHog's alias event, then expires the
// visitor's cookie, whatever the sign-up answered, so the answer never
// tells which addresses have an account. Nothing is linked at a sign-in,
// nor where PEAL_POSTHOG_SITE is off.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import {
  appWithPostHog,
  capturedEvents,
  eventsMatching,
  syntheticProjectToken,
  withFakePostHog,
} from "#test/shared/fake-posthog.ts";
import type { CapturedEvent } from "#test/shared/fake-posthog.ts";
import { appWithOidc, FakeOidc } from "#test/workspace/fakes/fake-oidc.ts";

import {
  confirmedAccount,
  MigratedSqlLive,
  newEmail,
  password,
  TestApp,
} from "./harness.ts";
import type { Reply } from "./harness.ts";
import {
  accountOf,
  finishSignIn,
  signUpPage,
  startSignIn,
  verified,
} from "./provider-support.ts";

const cookieName = `ph_${syntheticProjectToken}_posthog`;

const cookieDomain = "peal.example.test";

const site = {
  PEAL_POSTHOG_SITE: "on",
  PEAL_POSTHOG_SITE_COOKIE_DOMAIN: cookieDomain,
};

// A visitor's id as the site's SDK makes them: a version 7 UUID.
const newVisitor = (): string => {
  const random = randomUUID();

  return `${random.slice(0, 14)}7${random.slice(15)}`;
};

// The cookie posthog-js 1.450.0 keeps once a visitor allowed it, with
// `persistence: "cookie"`: its state as URL-encoded JSON.
const visitorCookie = (visitorId: string): string =>
  `${cookieName}=${encodeURIComponent(
    JSON.stringify({
      $device_id: visitorId,
      $epp: true,
      $sesid: [Date.now(), newVisitor(), Date.now() - 10_000],
      $user_state: "anonymous",
      distinct_id: visitorId,
    })
  )}`;

// The site's answer, as peal-ui writes it: allowed `daysAgo` days ago.
const allowed = (daysAgo = 0): string =>
  `peal.consent=1.a.${String(Math.floor(Date.now() / 86_400_000) - daysAgo)}`;

// The browser's cookies: the consent answer, the visitor's, a session's.
const browserCookies = (visitorId: string, answer = allowed()): string =>
  `${answer}; ${visitorCookie(visitorId)}`;

// What expires the visitor's cookie, on its parent domain.
const expiry = `${cookieName}=; Max-Age=0; Domain=${cookieDomain}; Path=/; Secure; SameSite=Lax`;

const visitorCookiesSet = (reply: Reply): readonly string[] =>
  reply.headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith(`${cookieName}=`));

const aliasOf =
  (visitorId: string) =>
  ({ event, properties }: CapturedEvent): boolean =>
    event === "$create_alias" && properties["alias"] === visitorId;

// Long enough for the server to have sent what it queued: a batch every
// two seconds at most.
const drained = Effect.sleep("5 seconds");

const signUp = (
  email: string,
  cookie: string,
  {
    headers = {},
    secret = password,
  }: {
    readonly headers?: Readonly<Record<string, string>>;
    readonly secret?: string;
  } = {}
) =>
  TestApp.use((app) =>
    app.request("/api/auth/sign-up/email", {
      body: {
        email,
        locale: "en",
        name: "Synthetic Visitor",
        password: secret,
      },
      headers: { ...headers, cookie },
    })
  );

const settings = { excludeTestServices: true, timeout: "180 seconds" } as const;

layer(
  Layer.mergeAll(
    appWithPostHog({ ...site, AUTH_REQUIRE_EMAIL_VERIFICATION: "true" }),
    MigratedSqlLive
  ),
  settings
)("a site's visitor, linked at sign-up", (it) => {
  it.effect(
    "is linked to the new account, then its cookie expires on the parent domain",
    () =>
      Effect.gen(function* linked() {
        const visitorId = newVisitor();

        const reply = yield* signUp(
          newEmail("site-visitor"),
          browserCookies(visitorId)
        );

        assert.strictEqual(reply.status, 200);
        assert.deepStrictEqual(visitorCookiesSet(reply), [expiry]);

        const [alias] = yield* eventsMatching(aliasOf(visitorId));
        const userId = alias?.distinct_id ?? "";

        assert.strictEqual(alias?.properties["distinct_id"], userId);
        assert.notStrictEqual(userId, visitorId);

        const [signedUp] = yield* eventsMatching(
          ({ distinct_id: id, event }) =>
            event === "user_signed_up" && id === userId
        );

        assert.isDefined(signedUp);
      })
  );

  it.effect(
    "expires the cookie of a sign-up for a known address the same way, and links nothing",
    () =>
      Effect.gen(function* known() {
        const email = newEmail("site-visitor-known");
        const first = yield* signUp(email, browserCookies(newVisitor()));

        assert.strictEqual(first.status, 200);

        const visitorId = newVisitor();
        const again = yield* signUp(email, browserCookies(visitorId));

        assert.strictEqual(again.status, 200);
        assert.deepStrictEqual(visitorCookiesSet(again), [expiry]);

        yield* drained;

        assert.isFalse((yield* capturedEvents).some(aliasOf(visitorId)));
      })
  );

  it.effect("links nothing and expires nothing at a sign-in", () =>
    Effect.gen(function* signIn() {
      const app = yield* TestApp;
      const account = yield* confirmedAccount("site-visitor-sign-in");
      const visitorId = newVisitor();

      const reply = yield* app.request("/api/auth/sign-in/email", {
        body: { email: account.email, password },
        headers: { cookie: browserCookies(visitorId) },
      });

      assert.strictEqual(reply.status, 200);
      assert.deepStrictEqual(visitorCookiesSet(reply), []);

      yield* drained;

      assert.isFalse((yield* capturedEvents).some(aliasOf(visitorId)));
    })
  );

  it.effect(
    "links nothing for an answer 183 days old, a refusal, or a browser that asks not to be followed, and still expires the cookie",
    () =>
      Effect.gen(function* notAllowed() {
        const cases = [
          { answer: allowed(183), headers: {} },
          {
            answer: `peal.consent=1.r.${String(Math.floor(Date.now() / 86_400_000))}`,
            headers: {},
          },
          { answer: allowed(), headers: { "sec-gpc": "1" } },
          { answer: allowed(), headers: { dnt: "1" } },
        ];

        const visitors = yield* Effect.forEach(
          cases,
          ({ answer, headers }, index) =>
            Effect.gen(function* oneCase() {
              const visitorId = newVisitor();

              const reply = yield* signUp(
                newEmail(`site-visitor-not-${String(index)}`),
                browserCookies(visitorId, answer),
                { headers }
              );

              assert.strictEqual(reply.status, 200);
              assert.deepStrictEqual(visitorCookiesSet(reply), [expiry]);

              return visitorId;
            })
        );

        yield* drained;

        const captured = yield* capturedEvents;

        for (const visitorId of visitors) {
          assert.isFalse(captured.some(aliasOf(visitorId)));
        }
      })
  );

  it.effect(
    "neither links nor expires anything for a refused sign-up, which a retry may still link",
    () =>
      Effect.gen(function* refused() {
        const visitorId = newVisitor();

        const reply = yield* signUp(
          newEmail("site-visitor-refused"),
          browserCookies(visitorId),
          { secret: "short" }
        );

        assert.strictEqual(reply.status, 400);
        assert.deepStrictEqual(visitorCookiesSet(reply), []);

        yield* drained;

        assert.isFalse((yield* capturedEvents).some(aliasOf(visitorId)));
      })
  );

  it.effect("expires nothing for a sign-up without the visitor's cookie", () =>
    Effect.gen(function* withoutCookie() {
      const reply = yield* signUp(
        newEmail("site-visitor-none"),
        `peal.consent=1.r.${String(Math.floor(Date.now() / 86_400_000))}`
      );

      assert.strictEqual(reply.status, 200);
      assert.deepStrictEqual(visitorCookiesSet(reply), []);
    })
  );
});

layer(
  Layer.mergeAll(
    appWithPostHog({
      AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
      PEAL_POSTHOG_SITE_COOKIE_DOMAIN: cookieDomain,
    }),
    MigratedSqlLive
  ),
  settings
)("a site's visitor, where PEAL_POSTHOG_SITE is off", (it) => {
  it.effect("is neither linked nor has its cookie expired", () =>
    Effect.gen(function* off() {
      const visitorId = newVisitor();

      const reply = yield* signUp(
        newEmail("site-visitor-off"),
        browserCookies(visitorId)
      );

      assert.strictEqual(reply.status, 200);
      assert.deepStrictEqual(visitorCookiesSet(reply), []);

      yield* drained;

      assert.isFalse((yield* capturedEvents).some(aliasOf(visitorId)));
    })
  );
});

layer(
  Layer.mergeAll(
    withFakePostHog((env) => appWithOidc({ ...env, ...site })),
    MigratedSqlLive
  ),
  settings
)("a site's visitor, linked at a provider's sign-up", (it) => {
  it.effect(
    "is linked to the account the callback made, then its cookie expires",
    () =>
      Effect.gen(function* provider() {
        const fake = yield* FakeOidc;
        const email = newEmail("site-visitor-oidc");
        const visitorId = newVisitor();

        const started = yield* startSignIn(
          signUpPage(),
          browserCookies(visitorId)
        );

        const identity = verified(email);
        const code = yield* fake.issue(identity, started.nonce);
        const finished = yield* finishSignIn(started, code);

        assert.isNull(finished.error);
        assert.deepStrictEqual(visitorCookiesSet(finished.reply), [expiry]);

        const account = yield* accountOf(email);
        const [alias] = yield* eventsMatching(aliasOf(visitorId));

        assert.strictEqual(alias?.distinct_id, account?.id);

        // Signing in again later expires nothing and links nothing more.
        const later = newVisitor();
        const again = yield* startSignIn(signUpPage(), browserCookies(later));
        const secondCode = yield* fake.issue(identity, again.nonce);
        const signedIn = yield* finishSignIn(again, secondCode);

        assert.isNull(signedIn.error);
        assert.deepStrictEqual(visitorCookiesSet(signedIn.reply), []);

        yield* drained;

        assert.isFalse((yield* capturedEvents).some(aliasOf(later)));
      })
  );
});
