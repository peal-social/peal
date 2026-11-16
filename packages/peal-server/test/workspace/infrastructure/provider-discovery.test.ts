// The sign-in providers' discovery: read when the server starts, a few
// times; served to Better Auth from a relay on this machine, so its own read
// never waits on the provider; a provider left out at start-up is read
// again in the background until it answers. A document that lacks what
// OpenID Connect requires stops the server.
import { once } from "node:events";
import { createServer } from "node:http";

import { assert, describe, it } from "@effect/vitest";
import {
  Effect,
  Logger,
  Metric,
  Option,
  Redacted,
  Schedule,
  Schema,
} from "effect";

import { fakeOidcWith } from "#test/workspace/fakes/fake-oidc.ts";
import {
  discoveryRelay,
  providersUnavailable,
} from "#workspace/infrastructure/auth/provider-discovery.ts";
import type { DiscoveryTiming } from "#workspace/infrastructure/auth/provider-discovery.ts";
import type { SignInProviderSettings } from "#workspace/infrastructure/auth/sign-in-provider-settings.ts";

const client = {
  clientId: "synthetic-oidc-client",
  clientSecret: Redacted.make("synthetic-oidc-secret"),
};

const at = (issuer: string): SignInProviderSettings => ({
  google: Option.none(),
  oidc: Option.some({
    ...client,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    issuer,
    name: "Synthetic directory",
    scopes: ["openid", "email", "profile"],
  }),
});

const quick: DiscoveryTiming = {
  attemptTimeout: "1 second",
  attempts: 3,
  backoff: "10 millis",
  retryAtMost: "50 millis",
  retryEvery: "10 millis",
};

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

const DocumentSchema = Schema.Struct({ issuer: Schema.String });

// A server that takes the connection and never answers.
const silentServer = Effect.acquireRelease(
  Effect.promise(async () => {
    const server = createServer(() => {
      // Never answers.
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const { port } = decodeAddress(server.address());

    return { server, url: `http://127.0.0.1:${String(port)}` };
  }),
  ({ server }) =>
    Effect.promise(async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    })
);

// What the relay answers for the provider, as Better Auth reads it.
const relayed = (settings: SignInProviderSettings) =>
  Effect.promise(async () => {
    const url = Option.getOrThrow(settings.oidc).discoveryUrl;
    const response = await fetch(url);
    const body: unknown = response.ok ? await response.json() : null;

    return { body, status: response.status, url };
  });

const discoveryReadsOf = (
  requests: () => readonly { readonly path: string }[]
) =>
  requests().filter(({ path }) => path === "/.well-known/openid-configuration")
    .length;

// Whether the gauge says the provider is off, now.
const unavailable = Metric.value(
  Metric.withAttributes(providersUnavailable, { provider: "oidc" })
).pipe(Effect.map(({ value }) => value));

// The servers this process listens with, now.
const listeners = () =>
  process
    .getActiveResourcesInfo()
    .filter((resource) => resource === "TCPServerWrap").length;

describe("the sign-in providers' discovery", () => {
  it.live("opens no relay where no provider is set", () =>
    Effect.scoped(
      Effect.gen(function* none() {
        const before = listeners();

        const relay = yield* discoveryRelay(
          { google: Option.none(), oidc: Option.none() },
          quick
        );

        assert.strictEqual(listeners(), before);
        assert.deepStrictEqual(relay.settings, {
          google: Option.none(),
          oidc: Option.none(),
        });
        assert.deepStrictEqual(yield* relay.offered, []);
      })
    )
  );

  it.live("serves a provider's document from this machine", () =>
    Effect.scoped(
      Effect.gen(function* serves() {
        const fake = yield* fakeOidcWith({});
        const relay = yield* discoveryRelay(at(fake.server.url), quick);
        const answer = yield* relayed(relay.settings);

        assert.deepStrictEqual(yield* relay.offered, ["oidc"]);
        assert.match(answer.url, /^http:\/\/127\.0\.0\.1:\d+\//u);
        assert.notInclude(answer.url, fake.server.url);
        assert.strictEqual(
          Schema.decodeUnknownSync(DocumentSchema)(answer.body).issuer,
          fake.server.url
        );
        // Read once, by Peal; Better Auth reads the relay.
        assert.strictEqual(discoveryReadsOf(fake.server.requests), 1);
      })
    )
  );

  it.live("reads it again at start-up before leaving the provider out", () =>
    Effect.scoped(
      Effect.gen(function* retries() {
        const fake = yield* fakeOidcWith({ unavailableFor: 2 });
        const relay = yield* discoveryRelay(at(fake.server.url), quick);

        assert.deepStrictEqual(yield* relay.offered, ["oidc"]);
        assert.strictEqual(discoveryReadsOf(fake.server.requests), 3);
      })
    )
  );

  it.live("keeps reading in the background until the provider answers", () =>
    Effect.scoped(
      Effect.gen(function* background() {
        const fake = yield* fakeOidcWith({ unavailableFor: 6 });
        const relay = yield* discoveryRelay(at(fake.server.url), quick);

        assert.deepStrictEqual(yield* relay.offered, []);
        assert.strictEqual((yield* relayed(relay.settings)).status, 503);

        const later = yield* relay.offered.pipe(
          Effect.filterOrFail((offered) => offered.length > 0),
          Effect.retry(Schedule.spaced("20 millis")),
          Effect.timeout("5 seconds")
        );

        assert.deepStrictEqual(later, ["oidc"]);
        assert.strictEqual((yield* relayed(relay.settings)).status, 200);
      })
    )
  );

  // A provider down for a day would otherwise keep the server's error-log
  // alert lit all day, hiding every other error: its own alert reads the
  // gauge.
  it.live(
    "logs a provider left out as an error once, its repeats as warnings, and says so in a gauge",
    () =>
      Effect.gen(function* repeats() {
        const levels: string[] = [];

        const capture = Logger.layer([
          Logger.make(({ logLevel, message }) => {
            if (String(message).includes("Sign-in with")) {
              levels.push(logLevel);
            }
          }),
        ]);

        yield* Effect.scoped(
          Effect.gen(function* down() {
            const fake = yield* fakeOidcWith({ unavailableFor: 6 });
            const relay = yield* discoveryRelay(at(fake.server.url), quick);

            assert.strictEqual(yield* unavailable, 1);

            yield* relay.offered.pipe(
              Effect.filterOrFail((offered) => offered.length > 0),
              Effect.retry(Schedule.spaced("20 millis")),
              Effect.timeout("5 seconds")
            );

            assert.strictEqual(yield* unavailable, 0);

            // The line that says it is back follows.
            yield* Effect.sync(() => levels.at(-1)).pipe(
              Effect.filterOrFail((last) => last === "Info"),
              Effect.retry(Schedule.spaced("20 millis")),
              Effect.timeout("5 seconds")
            );
          })
        ).pipe(Effect.provide(capture));

        assert.deepStrictEqual(levels, [
          "Error",
          "Warn",
          "Warn",
          "Warn",
          "Info",
        ]);
      })
  );

  it.live("says in the gauge that a provider which answers is on", () =>
    Effect.scoped(
      Effect.gen(function* on() {
        const fake = yield* fakeOidcWith({});

        yield* Metric.update(
          Metric.withAttributes(providersUnavailable, { provider: "oidc" }),
          1
        );
        yield* discoveryRelay(at(fake.server.url), quick);

        assert.strictEqual(yield* unavailable, 0);
      })
    )
  );

  it.live("leaves out a provider that does not answer in time", () =>
    Effect.scoped(
      Effect.gen(function* silent() {
        const { url } = yield* silentServer;
        const started = Date.now();

        const relay = yield* discoveryRelay(at(url), {
          ...quick,
          attemptTimeout: "100 millis",
          attempts: 2,
          retryAtMost: "1 hour",
          retryEvery: "1 hour",
        });

        assert.deepStrictEqual(yield* relay.offered, []);
        assert.isBelow(Date.now() - started, 3000);
      })
    )
  );

  it.live("stops on a document without the signing algorithms", () =>
    Effect.scoped(
      Effect.gen(function* incomplete() {
        const fake = yield* fakeOidcWith({ withoutSigningAlgorithms: true });

        const failure = yield* discoveryRelay(at(fake.server.url), quick).pipe(
          Effect.flip
        );

        assert.include(
          failure.message,
          "id_token_signing_alg_values_supported"
        );
        assert.include(failure.message, "Synthetic directory");
      })
    )
  );
});
