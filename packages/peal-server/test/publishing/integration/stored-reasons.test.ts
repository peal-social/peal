// An article a release before stored as failed for one of the posts'
// reasons, none of articles' own: every read of it reads the content
// refused, with the code it was stored with, so nothing that lists,
// changes, exports or erases its workspace dies on it.
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

import {
  claimArticleRun,
  settleArticleRun,
} from "#publishing/application/article-publication.ts";
import { ArticleRecords } from "#publishing/application/article-records.ts";
import { ArticleStore } from "#publishing/application/article-store.ts";
import { Articles } from "#publishing/application/articles.ts";
import { MediaInArticles } from "#publishing/application/media-in-articles.ts";
import { ArticleDecisionSchema } from "#publishing/domain/article-failure.ts";
import { DrizzleArticleStore } from "#publishing/infrastructure/drizzle-article-store.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { coverImage, siteChannel } from "#test/publishing/article-server.ts";
import {
  content,
  onArticles,
  writer,
  zone,
} from "#test/publishing/article-support.ts";

// What the release before wrote for a WordPress site that answered
// `appNotAudited`: one of the posts' own reasons.
const storedState = JSON.stringify({
  _tag: "failed",
  code: "appNotAudited",
  failedAt: "2026-06-15T06:00:05.000Z",
  reason: "appNotAudited",
  schedule: { at: "2026-06-15T06:00:00.000Z", timeZone: "Europe/Paris" },
});

// A job's stored `send/<n>` result, as the cluster keeps it, holding that
// reason: what a replay after a deploy reads before `settle` runs.
const storedReply = {
  exit: {
    _tag: "Success",
    value: {
      _tag: "Complete",
      exit: {
        _tag: "Success",
        value: {
          _tag: "settle",
          settlement: {
            _tag: "failed",
            code: "repliesNotAllowed",
            reason: "repliesNotAllowed",
          },
        },
      },
    },
  },
};

const StoredReplySchema = Schema.Struct({
  exit: Schema.Struct({
    value: Schema.Struct({
      exit: Schema.Struct({ value: Schema.Unknown }),
    }),
  }),
});

const MediaInArticlesTest = MediaInArticles.layer.pipe(
  Layer.provide(DrizzleArticleStore)
);

describe("an article stored failed for a reason of posts", () => {
  it.effect(
    "is listed, read, changed, exported and erased as the content refused",
    () =>
      onArticles(
        Effect.gen(function* storedFailed() {
          const site = yield* fakeWordPress();
          const workspaceId = yield* freshWorkspace;
          const channel = yield* siteChannel(workspaceId, site);
          const articles = yield* Articles;
          const records = yield* ArticleRecords;
          const actor = writer(workspaceId);
          const sql = yield* SqlClient.SqlClient;

          const draft = yield* articles.create(
            actor,
            { channelId: channel.id, content: content() },
            Option.none()
          );

          yield* sql`UPDATE publishing.articles
            SET status = 'failed', state = ${storedState}::jsonb
            WHERE id = ${draft.id}`;

          const read = yield* articles.get(actor, draft.id);

          assert.deepStrictEqual(
            read.state._tag === "failed"
              ? { code: read.state.code, reason: read.state.reason }
              : read.state._tag,
            { code: "appNotAudited", reason: "contentRejected" }
          );

          const page = yield* articles.page(actor, {
            before: Option.none(),
            limit: 10,
            status: Option.none(),
          });

          assert.deepStrictEqual(
            page.items.map(({ id }) => id),
            [draft.id]
          );

          const [exported] = yield* records.exportWorkspace(workspaceId);

          assert.deepStrictEqual(exported?.state, {
            _tag: "failed",
            code: "appNotAudited",
            failedAt: "2026-06-15T06:00:05.000Z",
            reason: "contentRejected",
            schedule: {
              at: "2026-06-15T06:00:00.000Z",
              timeZone: "Europe/Paris",
            },
          });

          // The library's question for a file it shows, which a failed
          // article lets go of.
          const usage = yield* MediaInArticles.use((inArticles) =>
            inArticles.usage(workspaceId, coverImage.media.mediaId)
          ).pipe(Effect.provide(MediaInArticlesTest));

          assert.deepStrictEqual(usage, { drafts: [draft.id], scheduled: [] });

          // A failed article takes an edit, and is sent again.
          yield* articles.update(
            actor,
            draft.id,
            content({ title: "Spring sowing, again" })
          );

          yield* records.ensureErasable(workspaceId);
          yield* records.eraseWorkspace(workspaceId);

          const left = yield* ArticleStore.use((store) => store.get(draft.id));

          assert.isTrue(Option.isNone(left));
        })
      )
  );

  it.effect(
    "settles from a stored attempt's decision that names it, as the content refused",
    () =>
      onArticles(
        Effect.gen(function* replayed() {
          const site = yield* fakeWordPress();
          const workspaceId = yield* freshWorkspace;
          const channel = yield* siteChannel(workspaceId, site);
          const articles = yield* Articles;
          const actor = writer(workspaceId);

          const article = yield* articles.create(
            actor,
            { channelId: channel.id, content: content() },
            Option.some({
              at: Option.some(DateTime.makeUnsafe("2026-06-20T09:30:00Z")),
              timeZone: zone,
            })
          );

          const job = {
            articleId: article.id,
            revision: article.revision,
            round: article.round,
          };

          // The job's claim, then the decision its stored `send/1` holds,
          // read with the activity's own schema, as the engine replays it.
          assert.strictEqual(
            yield* claimArticleRun(
              job,
              DateTime.makeUnsafe("2026-06-15T07:00:00Z")
            ),
            "claimed"
          );

          const stored =
            yield* Schema.decodeUnknownEffect(StoredReplySchema)(storedReply);

          const decision = yield* Schema.decodeUnknownEffect(
            Schema.toCodecJson(ArticleDecisionSchema)
          )(stored.exit.value.exit.value);

          assert(decision._tag === "settle");
          assert.strictEqual(
            yield* settleArticleRun(job, decision.settlement),
            "failed"
          );

          const settled = yield* articles.get(actor, article.id);

          assert.deepStrictEqual(
            settled.state._tag === "failed"
              ? { code: settled.state.code, reason: settled.state.reason }
              : settled.state._tag,
            { code: "repliesNotAllowed", reason: "contentRejected" }
          );
        })
      )
  );
});
