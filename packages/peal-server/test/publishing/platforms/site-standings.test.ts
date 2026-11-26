import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

import { SiteCalls } from "#publishing/application/site-calls.ts";
import { bodyOfText } from "#publishing/domain/rich-override.ts";
import { siteCallsWith } from "#publishing/infrastructure/platforms/sites/site-calls-live.ts";
import type { SiteFileJournal } from "#shared/application/site-call-journal.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import type { SiteStanding } from "#shared/domain/rich-text/site-standing.ts";
import { fakeDevTo, gardener } from "#test/channels/fakes/fake-devto.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

import { channelId, mediaOf, workspaceId } from "./support.ts";

// How a website's post stands once Peal changed it there: held for the
// site to publish itself at a time (WordPress's `future` with
// `date_gmt`, DEV published with a `published_at` ahead), a draft taken
// back, or out now; a post the site no longer has is gone; an edit
// (`asItIs`) leaves its status and date alone.

const at = DateTime.makeUnsafe("2026-06-20T09:30:00Z");

const later = DateTime.makeUnsafe("2026-06-21T10:00:00Z");

const article: OutgoingArticle = {
  channelId,
  content: {
    body: bodyOfText("Held by the site until its time.", []),
    categories: [],
    coverMediaId: Option.none(),
    excerpt: Option.none(),
    siteStatus: "publish",
    tags: [],
    title: "A synthetic article",
  },
  publishAt: Option.none(),
  workspaceId,
};

// A journal of files that never sent any.
const noFiles: SiteFileJournal = {
  featuredRefused: () => Effect.void,
  fileSent: () => Effect.void,
  filesSent: Effect.succeed(new Map()),
  forgetFile: () => Effect.void,
  recordedOn: () => Effect.succeed(new Set()),
};

const callsOn = (devtoApi = "http://127.0.0.1:9") =>
  Layer.build(
    siteCallsWith({
      devto: { api: devtoApi },
      hashnode: { api: "http://127.0.0.1:9/" },
      wordpressCom: { api: "http://127.0.0.1:9" },
    }).pipe(
      Layer.provide(mediaOf([])),
      Layer.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
    )
  );

const update = (
  token: SiteToken,
  platformPostId: string,
  standing: SiteStanding
) =>
  SiteCalls.use((calls) =>
    calls.update(article, noFiles, platformPostId, token, standing)
  );

describe("a website's post changed by Peal", () => {
  it.effect(
    "on WordPress, is held, re-dated, taken back, put out, and published by the site at its time",
    () =>
      Effect.gen(function* wordpress() {
        yield* TestClock.setTime(
          DateTime.toEpochMillis(DateTime.makeUnsafe("2026-06-15T08:00:00Z"))
        );

        const site = yield* fakeWordPress();
        const context = yield* callsOn();

        const id = site.addPost({
          author: 7,
          status: "draft",
          title: "A synthetic article",
        });

        const token: SiteToken = {
          credential: Redacted.make(`${editor.login}:${editor.password}`),
          platform: "wordpress",
          root: site.root,
        };

        const held = yield* update(token, String(id), {
          _tag: "hold",
          at,
        }).pipe(Effect.provideContext(context));

        assert.strictEqual(held._tag, "changed");
        assert.deepStrictEqual(
          site.posts().map(({ date_gmt, status }) => ({ date_gmt, status })),
          [{ date_gmt: "2026-06-20T09:30:00", status: "future" }]
        );

        yield* update(token, String(id), { _tag: "hold", at: later }).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(site.posts()[0]?.date_gmt, "2026-06-21T10:00:00");

        yield* update(token, String(id), { _tag: "draft" }).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(site.posts()[0]?.status, "draft");

        // An edit leaves the status as it stands.
        yield* update(token, String(id), { _tag: "asItIs" }).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(site.posts()[0]?.status, "draft");

        yield* update(token, String(id), { _tag: "publish" }).pipe(
          Effect.provideContext(context)
        );

        assert.deepStrictEqual(
          site.posts().map(({ date_gmt, status }) => ({ date_gmt, status })),
          [{ date_gmt: "2026-06-15T08:00:00", status: "publish" }]
        );

        // Held again, the site's own scheduler publishes it once its clock
        // passes the time.
        yield* update(token, String(id), { _tag: "hold", at }).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(site.posts()[0]?.status, "future");

        yield* TestClock.setTime(DateTime.toEpochMillis(at));

        assert.strictEqual(site.posts()[0]?.status, "publish");
      }).pipe(Effect.scoped)
  );

  it.effect(
    "on WordPress, is gone once the site deleted it, but for an edit, which says so",
    () =>
      Effect.gen(function* gone() {
        const site = yield* fakeWordPress();
        const context = yield* callsOn();

        const token: SiteToken = {
          credential: Redacted.make(`${editor.login}:${editor.password}`),
          platform: "wordpress",
          root: site.root,
        };

        for (const standing of [
          { _tag: "hold", at },
          { _tag: "draft" },
          { _tag: "publish" },
        ] as const) {
          assert.deepStrictEqual(
            yield* update(token, "404", standing).pipe(
              Effect.provideContext(context)
            ),
            { _tag: "gone" }
          );
        }

        const refused = yield* update(token, "404", { _tag: "asItIs" }).pipe(
          Effect.provideContext(context),
          Effect.flip
        );

        assert.strictEqual(refused._tag, "BadRequest");
      }).pipe(Effect.scoped)
  );

  it.effect("on DEV, is held, re-dated, taken back and put out", () =>
    Effect.gen(function* devto() {
      yield* TestClock.setTime(
        DateTime.toEpochMillis(DateTime.makeUnsafe("2026-06-15T08:00:00Z"))
      );

      const site = yield* fakeDevTo();
      const context = yield* callsOn(site.api);

      const id = String(
        site.addArticle({
          body_markdown: "Before",
          published: false,
          tags: [],
          title: "A synthetic article",
          userId: gardener.id,
        })
      );

      const token: SiteToken = {
        credential: Redacted.make(gardener.key),
        platform: "devto",
        root: String(gardener.id),
      };

      // DEV takes one write a second: the test's clock moves past each.
      const step = (standing: SiteStanding) =>
        update(token, id, standing).pipe(
          Effect.provideContext(context),
          Effect.tap(() => TestClock.adjust(Duration.seconds(2)))
        );

      const standing = () =>
        site
          .articles()
          .map(({ published, published_at }) => ({ published, published_at }));

      yield* step({ _tag: "hold", at });

      assert.deepStrictEqual(standing(), [
        { published: true, published_at: "2026-06-20T09:30:00.000Z" },
      ]);

      yield* step({ _tag: "hold", at: later });

      assert.deepStrictEqual(standing(), [
        { published: true, published_at: "2026-06-21T10:00:00.000Z" },
      ]);

      yield* step({ _tag: "draft" });

      assert.isFalse(site.articles()[0]?.published);

      yield* step({ _tag: "hold", at });
      yield* step({ _tag: "publish" });

      // Out now, not at the time it was held for.
      assert.deepStrictEqual(standing(), [
        { published: true, published_at: "2026-06-15T08:00:08.000Z" },
      ]);

      assert.deepStrictEqual(
        yield* update(token, "404", { _tag: "draft" }).pipe(
          Effect.provideContext(context)
        ),
        { _tag: "gone" }
      );
    }).pipe(Effect.scoped)
  );
});
