// A Hashnode token is checked on Hashnode's own API before it is
// connected, with the publication it is to publish to: the channel is the
// publication, and one without Hashnode's Pro plan is refused, said so.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { SiteRefused } from "#channels/application/site-refused.ts";
import { hashnodeVerifyKey } from "#channels/infrastructure/platforms/hashnode/hashnode-key-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  fakeHashnode,
  gardenBlog,
  writerOnHashnode,
} from "#test/channels/fakes/fake-hashnode.ts";
import type { FakeHashnodeOptions } from "#test/channels/fakes/fake-hashnode.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

const Http = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

const verifyWith = (
  options: FakeHashnodeOptions,
  publication?: string,
  token = writerOnHashnode.token
) =>
  fakeHashnode(options).pipe(
    Effect.flatMap((hashnode) =>
      hashnodeVerifyKey({ api: hashnode.api }).pipe(
        Effect.flatMap((verify) =>
          verify({
            apiKey: Redacted.make(token),
            platform: "hashnode",
            publication: Option.fromUndefinedOr(publication),
          })
        ),
        Effect.map((site) => ({ hashnode, site }))
      )
    )
  );

const refusalOf = (
  options: FakeHashnodeOptions,
  publication?: string,
  token?: string
) => verifyWith(options, publication, token).pipe(Effect.flip);

const secondBlog = {
  ...gardenBlog,
  id: "64f0000000000000000000b2",
  title: "Second Notes",
  url: "https://second.hashnode.example",
};

layer(Http)("checking a Hashnode token", (it) => {
  it.effect("reads the publication named, by its address", () =>
    Effect.gen(function* named() {
      const { hashnode, site } = yield* verifyWith(
        { publications: [gardenBlog, secondBlog] },
        "https://second.hashnode.example/some/post"
      );

      assert.strictEqual(site.accountId, secondBlog.id);
      assert.strictEqual(site.handle, "second.hashnode.example");
      assert.deepStrictEqual(site.displayName, Option.some("Second Notes"));
      assert.strictEqual(
        hashnode.requests()[0]?.authorization,
        writerOnHashnode.token
      );
    })
  );

  it.effect("takes the member's only publication when none is named", () =>
    Effect.gen(function* only() {
      const { site } = yield* verifyWith({});

      assert.strictEqual(site.accountId, gardenBlog.id);
    })
  );

  it.effect("asks which, among several, and refuses one not found", () =>
    Effect.gen(function* several() {
      assert.deepStrictEqual(
        yield* refusalOf({ publications: [gardenBlog, secondBlog] }),
        new SiteRefused({ reason: "publicationRequired" })
      );
      assert.deepStrictEqual(
        yield* refusalOf({}, "elsewhere.example"),
        new SiteRefused({ reason: "publicationNotFound" })
      );
    })
  );

  it.effect(
    "connects a team's publication only for its owners and editors",
    () =>
      Effect.gen(function* team() {
        const teamBlog = {
          ...secondBlog,
          ownerId: "64f0000000000000000000c9",
          title: "A Team's Notes",
        };

        const as = (role: "CONTRIBUTOR" | "EDITOR") => ({
          publications: [
            gardenBlog,
            { ...teamBlog, members: [{ role, userId: writerOnHashnode.id }] },
          ],
        });

        const { site } = yield* verifyWith(
          as("EDITOR"),
          "second.hashnode.example"
        );

        assert.strictEqual(site.accountId, teamBlog.id);
        assert.deepStrictEqual(
          yield* refusalOf(as("CONTRIBUTOR"), "second.hashnode.example"),
          new SiteRefused({ reason: "cannotPublish" })
        );
        assert.deepStrictEqual(
          yield* refusalOf(
            { publications: [gardenBlog, teamBlog] },
            "second.hashnode.example"
          ),
          new SiteRefused({ reason: "cannotPublish" })
        );
      })
  );

  it.effect("refuses a token Hashnode refuses", () =>
    Effect.gen(function* token() {
      assert.deepStrictEqual(
        yield* refusalOf({}, undefined, "synthetic-wrong"),
        new SiteRefused({ reason: "credentialsRefused" })
      );
    })
  );

  it.effect("says a publication needs Hashnode's Pro plan", () =>
    Effect.gen(function* plan() {
      const notPro = { ...secondBlog, ownerId: "someone-else", pro: false };

      assert.deepStrictEqual(
        yield* refusalOf(
          { publications: [gardenBlog, notPro] },
          "second.hashnode.example"
        ),
        new SiteRefused({ reason: "planRequired" })
      );
    })
  );

  it.effect("is unavailable when Hashnode fails", () =>
    Effect.gen(function* down() {
      assert.deepStrictEqual(
        yield* refusalOf({ intercept: () => ({ status: 503 }) }),
        new PlatformUnavailable()
      );
      assert.deepStrictEqual(
        yield* refusalOf({
          intercept: () => ({
            body: {
              data: null,
              errors: [
                { extensions: { code: "INTERNAL_SERVER_ERROR" }, message: "x" },
              ],
            },
            status: 200,
          }),
        }),
        new PlatformUnavailable()
      );
    })
  );
});
