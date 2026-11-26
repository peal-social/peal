import { assert, describe, it } from "@effect/vitest";
import { Context, Effect, Layer, Option, Redacted, Ref } from "effect";
import { FetchHttpClient } from "effect/http";

import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { PublicationJournal } from "#publishing/application/publication-journal.ts";
import { RecordedPosts } from "#publishing/application/recorded-posts.ts";
import { SiteCalls } from "#publishing/application/site-calls.ts";
import { SiteFiles } from "#publishing/application/site-files.ts";
import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { richOverride } from "#publishing/domain/rich-override.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { siteCallsWith } from "#publishing/infrastructure/platforms/sites/site-calls-live.ts";
import {
  articleOf,
  siteClient,
  siteCodeOf,
} from "#publishing/infrastructure/platforms/sites/site-client.ts";
import { siteLivePost } from "#publishing/infrastructure/platforms/sites/site-live-post.ts";
import type { SiteFile } from "#shared/application/site-call-journal.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type { FakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  progressInMemory,
  ProgressLog,
} from "#test/publishing/platforms/progress-log.ts";

import {
  attached,
  channelId,
  credentialsOf,
  mediaOf,
  outgoing,
  outgoingKey,
  testFile,
} from "./support.ts";

// A post's target on a website, through the site client: its options and
// its body as the site gets them, the files journaled by target, the
// commit mark on the call's progress, a site's codes kept as its own.

const picture = testFile("image", 4096);

const cover = testFile("image", 2048);

const credential = `${editor.login}:${editor.password}`;

const failureOf = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.flip);

type Kept = ReadonlyMap<string, ReadonlyMap<MediaAssetId, SiteFile>>;

// The target's files, changed by `change`.
const changed = (
  kept: Kept,
  targetId: string,
  change: (files: Map<MediaAssetId, SiteFile>) => void
): Kept => {
  const files = new Map<MediaAssetId, SiteFile>(kept.get(targetId));

  change(files);

  return new Map(kept).set(targetId, files);
};

// The files sent, kept in memory by target, as `site_files` keeps them.
const filesInMemory = Layer.effect(
  SiteFiles,
  Effect.gen(function* building() {
    const kept = yield* Ref.make<Kept>(new Map());

    return SiteFiles.of({
      featuredRefused: () => Effect.void,
      forget: (targetId, mediaId) =>
        Ref.update(kept, (all) =>
          changed(all, targetId, (files) => {
            files.delete(mediaId);
          })
        ),
      record: (targetId, mediaId, file) =>
        Ref.update(kept, (all) =>
          changed(all, targetId, (files) => {
            files.set(mediaId, file);
          })
        ),
      sent: (targetId) =>
        Ref.get(kept).pipe(Effect.map((all) => all.get(targetId) ?? new Map())),
    });
  })
);

// No earlier round committed a call, unless a test says when one did.
const journalOf = (committed: Option.Option<OutgoingPost["startedAt"]>) =>
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
  committed: Option.Option<OutgoingPost["startedAt"]> = Option.none()
) =>
  Effect.gen(function* building() {
    const credentials = credentialsOf(
      { accountId: site.root, platform: "wordpress" },
      [credential]
    );

    const calls = siteCallsWith({
      devto: { api: "http://127.0.0.1:9" },
      hashnode: { api: "http://127.0.0.1:9/" },
      wordpressCom: { api: "http://127.0.0.1:9" },
    }).pipe(
      Layer.provide(mediaOf([picture, cover])),
      Layer.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
    );

    const context = yield* Layer.build(
      Layer.mergeAll(
        calls,
        credentials,
        filesInMemory,
        progressInMemory,
        RecordedPosts.none,
        journalOf(committed)
      )
    );

    return {
      client: yield* siteClient("wordpress").pipe(
        Effect.provideContext(context)
      ),
      context,
    };
  });

const begun = Effect.gen(function* beginning() {
  const log = yield* ProgressLog;

  yield* log.begin(outgoingKey);
});

describe("a website's target", () => {
  it.effect(
    "arrives as an article: its title, its text as paragraphs, its images",
    () =>
      Effect.gen(function* plain() {
        const site = yield* fakeWordPress();
        const { client, context } = yield* clientOn(site);

        yield* begun.pipe(Effect.provideContext(context));

        const result = yield* client.publish(
          yield* outgoing({
            accountId: site.root,
            media: [attached(picture, "A cake")],
            options: Option.some(
              new WordPressOptions({
                coverMediaId: cover.media.mediaId,
                excerpt: "In short",
                platform: "wordpress",
                tags: ["Launch"],
                title: "Launch day",
              })
            ),
            text: "First line\nsecond line\n\nA new paragraph",
          })
        );

        assert.strictEqual(result._tag, "published");

        const [post] = site.posts();

        assert.strictEqual(post?.title, "Launch day");
        assert.strictEqual(post?.excerpt, "In short");
        assert.strictEqual(post?.status, "publish");
        assert.include(post?.content ?? "", "<p>First line<br>second line</p>");
        assert.include(post?.content ?? "", "<p>A new paragraph</p>");
        assert.include(post?.content ?? "", "<img");
        assert.strictEqual(site.media().length, 2);

        // The commit mark was recorded before the post's request.
        const steps = yield* ProgressLog.use((log) =>
          log.recorded(outgoingKey)
        ).pipe(Effect.provideContext(context));

        assert.lengthOf(steps, 1);
      }).pipe(Effect.scoped)
  );

  it.effect("with a rich override, arrives as the HTML of its body", () =>
    Effect.gen(function* rich() {
      const site = yield* fakeWordPress();
      const { client, context } = yield* clientOn(site);

      yield* begun.pipe(Effect.provideContext(context));

      const override = richOverride(channelId, {
        content: [
          {
            attrs: { level: 2 },
            content: [{ text: "What ships", type: "text" }],
            type: "heading",
          },
          {
            content: [
              { marks: [{ type: "bold" }], text: "Bold", type: "text" },
            ],
            type: "paragraph",
          },
        ],
        type: "doc",
      });

      yield* client.publish(
        yield* outgoing({
          accountId: site.root,
          body: Option.fromUndefinedOr(override.body),
          options: Option.some(
            new WordPressOptions({ platform: "wordpress", title: "Rich" })
          ),
          text: override.text,
        })
      );

      const [post] = site.posts();

      assert.include(post?.content ?? "", "<h2>What ships</h2>");
      assert.include(post?.content ?? "", "<strong>Bold</strong>");
    }).pipe(Effect.scoped)
  );

  it.effect("sends a file once across a retry", () =>
    Effect.gen(function* once() {
      const site = yield* fakeWordPress();
      const { client, context } = yield* clientOn(site);

      yield* begun.pipe(Effect.provideContext(context));

      const post = yield* outgoing({
        accountId: site.root,
        media: [attached(picture)],
        options: Option.some(
          new WordPressOptions({ platform: "wordpress", title: "Twice" })
        ),
      });

      yield* client.publish(post);
      yield* ProgressLog.use((log) => log.begin(`${outgoingKey}-2`)).pipe(
        Effect.provideContext(context)
      );
      yield* client.publish({ ...post, idempotencyKey: `${outgoingKey}-2` });

      assert.strictEqual(site.media().length, 1);
    }).pipe(Effect.scoped)
  );

  it.effect("after a run cut before its commit, is sent anew", () =>
    Effect.gen(function* cutBefore() {
      const site = yield* fakeWordPress();
      const { client, context } = yield* clientOn(site);

      yield* begun.pipe(Effect.provideContext(context));

      const result = yield* client.resume(
        yield* outgoing({
          accountId: site.root,
          options: Option.some(
            new WordPressOptions({ platform: "wordpress", title: "Anew" })
          ),
        })
      );

      assert.strictEqual(result._tag, "published");
      assert.lengthOf(site.posts(), 1);
    }).pipe(Effect.scoped)
  );

  it.effect(
    "after a run cut after its commit, is looked for and never made again",
    () =>
      Effect.gen(function* cutAfter() {
        const site = yield* fakeWordPress();
        const { client, context } = yield* clientOn(site);

        yield* begun.pipe(Effect.provideContext(context));

        const post = yield* outgoing({
          accountId: site.root,
          options: Option.some(
            new WordPressOptions({ platform: "wordpress", title: "Once only" })
          ),
        });

        yield* client.publish(post);

        // The first run made it and stopped before it recorded the answer.
        const found = yield* client.resume(post);

        assert.strictEqual(found._tag, "published");
        assert.lengthOf(site.posts(), 1);
      }).pipe(Effect.scoped)
  );

  it.effect(
    "in a new round, adopts the post an earlier round's call made",
    () =>
      Effect.gen(function* repost() {
        const site = yield* fakeWordPress();
        const first = yield* clientOn(site);

        yield* begun.pipe(Effect.provideContext(first.context));

        const post = yield* outgoing({
          accountId: site.root,
          options: Option.some(
            new WordPressOptions({ platform: "wordpress", title: "Adopted" })
          ),
        });

        yield* first.client.publish(post);

        const again = yield* clientOn(site, Option.some(post.startedAt));

        yield* begun.pipe(Effect.provideContext(again.context));

        const adopted = yield* again.client.publish({ ...post, round: 2 });

        assert.strictEqual(adopted._tag, "published");
        assert.lengthOf(site.posts(), 1);
      }).pipe(Effect.scoped)
  );

  it.effect("is taken down: WordPress's trash", () =>
    Effect.gen(function* unpublish() {
      const site = yield* fakeWordPress();
      const { client, context } = yield* clientOn(site);

      yield* begun.pipe(Effect.provideContext(context));

      const result = yield* client.publish(
        yield* outgoing({
          accountId: site.root,
          options: Option.some(
            new WordPressOptions({ platform: "wordpress", title: "Gone" })
          ),
        })
      );

      assert.strictEqual(result._tag, "published");

      if (result._tag !== "published") {
        return;
      }

      const remover = siteLivePost(Context.get(context, SiteCalls));

      const removed = yield* remover(
        {
          accessToken: Redacted.make(credential),
          accountId: site.root,
          connection: Option.none(),
          platform: "wordpress",
        },
        result.platformPostId
      );

      assert.strictEqual(removed, "removed");
      assert.strictEqual(site.posts()[0]?.status, "trash");
    }).pipe(Effect.scoped)
  );
});

describe("a site's code", () => {
  it("never reads as one of Peal's", () => {
    assert.strictEqual(
      siteCodeOf("wordpress", "rest_cannot_create"),
      "wordpress:rest_cannot_create"
    );
    assert.strictEqual(
      siteCodeOf("wordpress", "wordpress:channelDisconnected"),
      "wordpress:channelDisconnected"
    );
    assert.strictEqual(
      siteCodeOf("hashnode", "sitePlanRequired"),
      "sitePlanRequired"
    );
  });

  it.effect(
    "from WordPress, Peal's own word, fails the target as the site's",
    () =>
      Effect.gen(function* collision() {
        const site = yield* fakeWordPress({
          intercept: (request) =>
            request.method === "POST" && request.route === "/wp/v2/posts"
              ? {
                  body: { code: "channelDisconnected", message: "No" },
                  status: 400,
                }
              : undefined,
        });

        const { client, context } = yield* clientOn(site);

        yield* begun.pipe(Effect.provideContext(context));

        assert.deepStrictEqual(
          yield* failureOf(
            client.publish(
              yield* outgoing({
                accountId: site.root,
                options: Option.some(
                  new WordPressOptions({ platform: "wordpress", title: "No" })
                ),
              })
            )
          ),
          new BadRequest({ code: "wordpress:channelDisconnected" })
        );
      }).pipe(Effect.scoped)
  );
});

describe("the article a website gets", () => {
  it.effect("takes DEV's options, and the post's text as its body", () =>
    Effect.gen(function* devto() {
      const article = articleOf(
        yield* outgoing({
          accountId: "dev",
          options: Option.some(
            new DevtoOptions({
              platform: "devto",
              siteStatus: "draft",
              tags: ["launch"],
              title: "On DEV",
            })
          ),
          text: "Hello",
        })
      );

      assert.strictEqual(article.content.title, "On DEV");
      assert.strictEqual(article.content.siteStatus, "draft");
      assert.deepStrictEqual(article.content.categories, []);
      assert.deepStrictEqual(article.content.body, {
        content: [
          { content: [{ text: "Hello", type: "text" }], type: "paragraph" },
        ],
        type: "doc",
      });
      assert.isTrue(Option.isNone(article.publishAt));
    })
  );
});
