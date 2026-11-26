import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Ref } from "effect";
import { FetchHttpClient } from "effect/http";

import type {
  SiteCall,
  SiteCallStanding,
} from "#publishing/application/platform-client.ts";
import { PublicationJournal } from "#publishing/application/publication-journal.ts";
import { RecordedArticles } from "#publishing/application/recorded-articles.ts";
import { RecordedPosts } from "#publishing/application/recorded-posts.ts";
import { SiteFiles } from "#publishing/application/site-files.ts";
import type { SitePost } from "#publishing/domain/site-post.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { siteCallsWith } from "#publishing/infrastructure/platforms/sites/site-calls-live.ts";
import { siteClient } from "#publishing/infrastructure/platforms/sites/site-client.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type { FakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  progressInMemory,
  ProgressLog,
} from "#test/publishing/platforms/progress-log.ts";

import { credentialsOf, mediaOf, outgoing, outgoingKey } from "./support.ts";

// A website's target in a hand-over's call (`OutgoingPost.site`): the
// site client makes, re-dates, takes back, takes off or puts out the post
// the site holds for it, and records what the site then holds as soon as
// it answered.

const at = DateTime.makeUnsafe("2026-06-20T09:30:00Z");

const later = DateTime.makeUnsafe("2026-06-21T10:00:00Z");

// A journal of files that never sent any, as the site client keeps them.
const noFiles = Layer.succeed(
  SiteFiles,
  SiteFiles.of({
    featuredRefused: () => Effect.void,
    forget: () => Effect.void,
    record: () => Effect.void,
    sent: () => Effect.succeed(new Map()),
  })
);

// No earlier call committed, unless a test says when one did.
const journalOf = (committed: Option.Option<DateTime.Utc>) =>
  Layer.succeed(
    PublicationJournal,
    PublicationJournal.of({
      attemptsOf: () => Effect.succeed([]),
      begin: () => Effect.die("not begun here"),
      committedBefore: () => Effect.succeed(committed),
      earlierRefusals: () => Effect.die("not read here"),
      find: () => Effect.succeed(Option.none()),
      finish: () => Effect.void,
      recordAttempt: () => Effect.void,
    })
  );

const clientOn = (
  site: FakeWordPress,
  committed: Option.Option<DateTime.Utc> = Option.none()
) =>
  Effect.gen(function* building() {
    const context = yield* Layer.build(
      Layer.mergeAll(
        siteCallsWith({
          devto: { api: "http://127.0.0.1:9" },
          hashnode: { api: "http://127.0.0.1:9/" },
          wordpressCom: { api: "http://127.0.0.1:9" },
        }).pipe(
          Layer.provide(mediaOf([])),
          Layer.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
        ),
        credentialsOf({ accountId: site.root, platform: "wordpress" }, [
          `${editor.login}:${editor.password}`,
        ]),
        noFiles,
        progressInMemory,
        RecordedPosts.none,
        RecordedArticles.none,
        journalOf(committed)
      )
    );

    yield* ProgressLog.use((log) => log.begin(outgoingKey)).pipe(
      Effect.provideContext(context)
    );

    return yield* siteClient("wordpress").pipe(Effect.provideContext(context));
  });

// A call of `standing`, with what the site holds for the target, whose
// records are kept in `kept`; the target is gone when `gone`.
const callOf = (
  kept: Ref.Ref<readonly Option.Option<SitePost>[]>,
  standing: SiteCallStanding,
  held: Option.Option<SitePost> = Option.none(),
  gone = false
): SiteCall => ({
  held,
  record: (onSite) =>
    Ref.update(kept, (all) => [...all, onSite]).pipe(Effect.as(!gone)),
  standing,
});

const postWith = (site: FakeWordPress, call: SiteCall) =>
  outgoing({
    accountId: site.root,
    options: Option.some(
      new WordPressOptions({ title: "A synthetic article" })
    ),
    site: call,
    text: "Held by the site until its time.",
  });

const heldPost = (site: FakeWordPress) => {
  const [post] = site.posts();

  return {
    platformPostId: PlatformPostIdSchema.make(String(post?.id)),
    permalink: `${new URL(site.home).origin}/?p=${post?.id}`,
  };
};

describe("a website's target handed over", () => {
  it.effect("is made held for its time, and recorded so at once", () =>
    Effect.gen(function* made() {
      const site = yield* fakeWordPress();
      const client = yield* clientOn(site);
      const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

      const result = yield* client.publish(
        yield* postWith(site, callOf(kept, { _tag: "hold", at }))
      );

      assert.strictEqual(result._tag, "published");
      assert.deepStrictEqual(
        site.posts().map(({ date_gmt, status }) => ({ date_gmt, status })),
        [{ date_gmt: "2026-06-20T09:30:00", status: "future" }]
      );
      assert.deepStrictEqual(yield* Ref.get(kept), [
        Option.some({ ...heldPost(site), publishAt: at }),
      ]);
    }).pipe(Effect.scoped)
  );

  it.effect("re-dates the post it holds, never making a second", () =>
    Effect.gen(function* redated() {
      const site = yield* fakeWordPress();
      const client = yield* clientOn(site);
      const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

      yield* client.publish(
        yield* postWith(site, callOf(kept, { _tag: "hold", at }))
      );

      const held = { ...heldPost(site), publishAt: at };

      yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "hold", at: later }, Option.some(held))
        )
      );

      assert.lengthOf(site.posts(), 1);
      assert.strictEqual(site.posts()[0]?.date_gmt, "2026-06-21T10:00:00");
      assert.deepStrictEqual(
        (yield* Ref.get(kept)).at(-1),
        Option.some({ ...held, publishAt: later })
      );
    }).pipe(Effect.scoped)
  );

  it.effect("takes it back to a draft, then off the site, recording each", () =>
    Effect.gen(function* takenBack() {
      const site = yield* fakeWordPress();
      const client = yield* clientOn(site);
      const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

      yield* client.publish(
        yield* postWith(site, callOf(kept, { _tag: "hold", at }))
      );

      const held = { ...heldPost(site), publishAt: at };

      yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "draft" }, Option.some(held))
        )
      );

      assert.strictEqual(site.posts()[0]?.status, "draft");
      assert.deepStrictEqual(
        (yield* Ref.get(kept)).at(-1),
        Option.some(heldPost(site))
      );

      yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "remove" }, Option.some(heldPost(site)))
        )
      );

      assert.strictEqual(site.posts()[0]?.status, "trash");
      assert.deepStrictEqual((yield* Ref.get(kept)).at(-1), Option.none());
    }).pipe(Effect.scoped)
  );

  it.effect("at the post's time, puts out the post the site holds", () =>
    Effect.gen(function* putOut() {
      const site = yield* fakeWordPress();
      const client = yield* clientOn(site);
      const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

      yield* client.publish(
        yield* postWith(site, callOf(kept, { _tag: "hold", at }))
      );

      yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "draft" }, Option.some(heldPost(site)))
        )
      );

      const result = yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "publish" }, Option.some(heldPost(site)))
        )
      );

      assert.lengthOf(site.posts(), 1);
      assert.strictEqual(site.posts()[0]?.status, "publish");
      assert.deepStrictEqual(result, {
        _tag: "published",
        permalink: heldPost(site).permalink,
        platformPostId: heldPost(site).platformPostId,
      });
    }).pipe(Effect.scoped)
  );

  it.effect("takes off a post it made for a target gone meanwhile", () =>
    Effect.gen(function* gone() {
      const site = yield* fakeWordPress();
      const client = yield* clientOn(site);
      const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

      yield* client.publish(
        yield* postWith(
          site,
          callOf(kept, { _tag: "hold", at }, Option.none(), true)
        )
      );

      assert.deepStrictEqual(
        site.posts().map(({ status }) => status),
        ["trash"]
      );
    }).pipe(Effect.scoped)
  );

  it.effect(
    "adopts the post a lost answer left on the site, re-dated, never made twice",
    () =>
      Effect.gen(function* adopted() {
        const site = yield* fakeWordPress();
        const earlier = DateTime.makeUnsafe("2026-06-15T08:00:00Z");

        // An earlier hand-over made it, and its answer was lost.
        site.addPost({
          author: editor.id,
          date_gmt: "2026-06-20T09:30:00",
          modified_gmt: "2026-06-15T08:00:01",
          status: "future",
          title: "A synthetic article",
        });

        const client = yield* clientOn(site, Option.some(earlier));
        const kept = yield* Ref.make<readonly Option.Option<SitePost>[]>([]);

        yield* client.publish(
          yield* postWith(site, callOf(kept, { _tag: "hold", at: later }))
        );

        assert.lengthOf(site.posts(), 1);
        assert.strictEqual(site.posts()[0]?.date_gmt, "2026-06-21T10:00:00");
        assert.deepStrictEqual(
          (yield* Ref.get(kept)).map(Option.map(({ publishAt }) => publishAt)),
          [Option.some(later)]
        );
      }).pipe(Effect.scoped)
  );
});
