import { createServer } from "node:http";

import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Metric, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import type { HttpClient } from "effect/http";

import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  outboundResponses,
  serviceOf,
  statusClassOf,
} from "#shared/infrastructure/platforms/outbound-responses.ts";
import {
  publicFetch,
  publicHttpClientWith,
  publicLibraryHttpClientWith,
} from "#shared/infrastructure/platforms/public-http.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

const statuses = ["2xx", "3xx", "4xx", "429", "5xx", "failed"] as const;

type Counts = Record<(typeof statuses)[number], number>;

const countOf = (service: string, status: string) =>
  Metric.value(
    Metric.withAttributes(outboundResponses, { service, status })
  ).pipe(Effect.map(({ count }) => count));

const countsOf = (service: string): Effect.Effect<Counts> =>
  Effect.all({
    "2xx": countOf(service, "2xx"),
    "3xx": countOf(service, "3xx"),
    "429": countOf(service, "429"),
    "4xx": countOf(service, "4xx"),
    "5xx": countOf(service, "5xx"),
    failed: countOf(service, "failed"),
  });

// What `effect` added to the counts of the `other` service.
const countedBy = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* counted() {
    const before = yield* countsOf("other");

    yield* effect;

    const after = yield* countsOf("other");

    return Object.fromEntries(
      statuses.map((status) => [status, after[status] - before[status]])
    );
  });

const none: Counts = {
  "2xx": 0,
  "3xx": 0,
  "429": 0,
  "4xx": 0,
  "5xx": 0,
  failed: 0,
};

// A host that answers `/<status>` with that status, and never answers
// `/silent`.
const fakeHost = Effect.acquireRelease(
  Effect.callback<{
    readonly close: () => void;
    readonly url: string;
  }>((resume) => {
    const server = createServer((request, response) => {
      const status = Number(request.url?.slice(1));

      if (Number.isNaN(status)) {
        return;
      }

      response.statusCode = status;
      response.end();
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = decodeAddress(server.address());

      resume(
        Effect.succeed({
          close: () => {
            server.closeAllConnections();
            server.close();
          },
          url: `http://127.0.0.1:${port}`,
        })
      );
    });
  }),
  ({ close }) => Effect.sync(close)
);

const RefusingGuard = Layer.succeed(
  OutboundGuard,
  OutboundGuard.of({
    check: (url) =>
      Effect.fail(
        new OutboundRequestRefused({ host: url.host, reason: "notPublic" })
      ),
  })
);

const sendAll = <E>(
  client: HttpClient.HttpClient.With<E>,
  urls: readonly string[]
) =>
  Effect.forEach(urls, (url) => client.get(url).pipe(Effect.ignore), {
    concurrency: 1,
  });

describe("counting outbound responses", () => {
  it.live(
    "counts each request by status class, and a host off the list as other",
    () =>
      Effect.gen(function* countsByStatus() {
        const host = yield* fakeHost;
        const client = yield* publicHttpClientWith({ timeout: "200 millis" });

        const counted = yield* countedBy(
          sendAll(
            client,
            ["200", "204", "302", "404", "429", "500", "503", "silent"].map(
              (path) => `${host.url}/${path}`
            )
          )
        );

        assert.deepStrictEqual(counted, {
          "2xx": 2,
          "3xx": 1,
          "429": 1,
          "4xx": 1,
          "5xx": 2,
          failed: 1,
        });
      }).pipe(
        Effect.scoped,
        Effect.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard))
      )
  );

  it.live("counts a request the host never answers as failed", () =>
    Effect.gen(function* countsLost() {
      const client = yield* publicLibraryHttpClientWith({
        timeout: "2 seconds",
      });

      // A port nothing listens on.
      const counted = yield* countedBy(
        sendAll(client, ["http://127.0.0.1:9/200"])
      );

      assert.deepStrictEqual(counted, { ...none, failed: 1 });
    }).pipe(
      Effect.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard))
    )
  );

  it.live("counts a request the guard refuses as failed", () =>
    Effect.gen(function* countsRefused() {
      const client = yield* publicHttpClientWith({ timeout: "2 seconds" });

      const library = yield* publicLibraryHttpClientWith({
        timeout: "2 seconds",
      });

      const counted = yield* countedBy(
        Effect.all([
          sendAll(client, ["https://wordpress.example/wp-json"]),
          sendAll(library, ["https://ai.example/v1/chat/completions"]),
        ])
      );

      assert.deepStrictEqual(counted, { ...none, failed: 2 });
    }).pipe(
      Effect.provide(Layer.mergeAll(FetchHttpClient.layer, RefusingGuard))
    )
  );

  it.live("counts the requests of the public fetch too", () =>
    Effect.gen(function* countsFetch() {
      const host = yield* fakeHost;
      const fetch = yield* publicFetch;

      const counted = yield* countedBy(
        Effect.forEach(
          ["200", "429", "502"],
          (path) =>
            Effect.promise(async () => {
              const response = await fetch(`${host.url}/${path}`);

              return response.status;
            }),
          { concurrency: 1 }
        )
      );

      assert.deepStrictEqual(counted, {
        ...none,
        "2xx": 1,
        "429": 1,
        "5xx": 1,
      });
    }).pipe(Effect.scoped, Effect.provide(OpenOutboundGuard))
  );
});

describe("the service of a host", () => {
  it("names each platform Peal calls by its own service", () => {
    const hosts = {
      "api-sandbox.pinterest.com": "pinterest",
      "api.anthropic.com": "anthropic",
      "api.shotstack.io": "shotstack",
      "api.instagram.com": "meta",
      "api.linkedin.com": "linkedin",
      "api.pinterest.com": "pinterest",
      "api.telegram.org": "telegram",
      "api.x.com": "x",
      "bsky.social": "bluesky",
      "canary.discord.com": "discord",
      "dev.to": "devto",
      "discord.com": "discord",
      "files.slack.com": "slack",
      "googleads.googleapis.com": "googleAds",
      "gql-beta.hashnode.com": "hashnode",
      "gql.hashnode.com": "hashnode",
      "graph.facebook.com": "meta",
      "graph.instagram.com": "meta",
      "graph.threads.com": "threads",
      "graph.threads.net": "threads",
      "morel.us-east.host.bsky.network": "bluesky",
      "mybusiness.googleapis.com": "googleBusiness",
      "mybusinessaccountmanagement.googleapis.com": "googleBusiness",
      "oauth2.googleapis.com": "google",
      "open-upload.tiktokapis.com": "tiktok",
      "open.tiktokapis.com": "tiktok",
      "plc.directory": "bluesky",
      "public-api.wordpress.com": "wordpress",
      "public.api.bsky.app": "bluesky",
      "rupload.facebook.com": "meta",
      "slack.com": "slack",
      "upload.x.com": "x",
      "video.bsky.app": "bluesky",
      "www.googleapis.com": "youtube",
      "youtube.googleapis.com": "youtube",
      "youtubeanalytics.googleapis.com": "youtube",
      "www.linkedin.com": "linkedin",
    };

    expect(
      Object.fromEntries(
        Object.keys(hosts).map((host) => [host, serviceOf(host)])
      )
    ).toStrictEqual(hosts);
  });

  it("reads a host in any case, with or without its final dot", () => {
    expect(serviceOf("Graph.Facebook.COM.")).toBe("meta");
  });

  it("names every other host other, never the host itself", () => {
    for (const host of [
      "mastodon.social",
      "blog.example",
      "hooks.example.com",
      "ai.self-hosted.example",
      "scontent.cdninstagram.com",
      "notfacebook.com",
      "facebook.com.attacker.example",
      "googleapis.com.example",
      "127.0.0.1",
      "",
    ]) {
      expect(serviceOf(host)).toBe("other");
    }
  });
});

describe("the class of a status", () => {
  it("puts 429 apart from the other 4xx", () => {
    expect(
      [200, 201, 301, 400, 429, 499, 500, 504].map(statusClassOf)
    ).toStrictEqual(["2xx", "2xx", "3xx", "4xx", "429", "4xx", "5xx", "5xx"]);
  });
});
