import { Context, DateTime, Effect, Layer, Option } from "effect";

import { contentWithout } from "#publishing/domain/article-content.ts";
import type { ArticleId } from "#publishing/domain/article-id.ts";
import { fileDeleted, mayStillBeSent } from "#publishing/domain/article.ts";
import type { Article } from "#publishing/domain/article.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";

import { ArticleStore } from "./article-store.ts";

/** The articles that show a file of the library, by where they are. */
export interface ArticleMediaUse {
  /** Drafts, failed ones and those to check: they lose the file when it goes. */
  readonly drafts: readonly ArticleId[];
  /** Those scheduled or being sent: they keep it from being deleted. */
  readonly scheduled: readonly ArticleId[];
}

/** The articles that show a file, held until the transaction around ends. */
export interface ArticleMediaHold {
  /** Takes the file off those that may still be sent. */
  readonly letGo: Effect.Effect<void, DatabaseError>;
  /** Those that keep the file: scheduled or being sent. */
  readonly scheduled: readonly ArticleId[];
}

// An article that still goes out, so needs its files.
const goesOut = (article: Article) =>
  article.state._tag === "scheduled" || article.state._tag === "publishing";

// The articles that show the media, by where they are: those on their
// site, which keep the id they went out with, are in neither.
const articleUse = (shown: readonly Article[]): ArticleMediaUse => ({
  drafts: shown.flatMap((article) =>
    mayStillBeSent(article) ? [article.id] : []
  ),
  scheduled: shown.flatMap((article) => (goesOut(article) ? [article.id] : [])),
});

/**
 * Which articles show a file of the library, for the media context, which
 * asks before deleting one: an article scheduled or being sent keeps it,
 * drafts, failed ones and those to check lose it, and one on its site
 * keeps the id it went out with. It acts for the workspace, as the media
 * context checked who deletes.
 */
export class MediaInArticles extends Context.Service<
  MediaInArticles,
  {
    /** The articles that show the file, by where they are. */
    readonly usage: (
      workspaceId: WorkspaceId,
      mediaId: MediaAssetId
    ) => Effect.Effect<ArticleMediaUse, DatabaseError>;
    /**
     * Locks the articles that show the file until the transaction around
     * this ends: one scheduled meanwhile waits, and then finds the file gone
     * from it. `scheduled` are those that keep the file; `letGo` takes it off
     * those that may still be sent. It opens no transaction: call it in the
     * caller's, as `ArticleStore.lock`.
     */
    readonly hold: (
      workspaceId: WorkspaceId,
      mediaId: MediaAssetId
    ) => Effect.Effect<ArticleMediaHold, DatabaseError>;
  }
>()("peal-server/articles/application/MediaInArticles") {
  static readonly layer = Layer.effect(
    MediaInArticles,
    Effect.gen(function* MediaInArticlesLive() {
      const articles = yield* ArticleStore;

      // An article that may still be sent without the media, under its
      // row lock.
      const detachArticle = (article: Article, mediaId: MediaAssetId) =>
        DateTime.now.pipe(
          Effect.flatMap((now) =>
            Option.match(
              fileDeleted(
                article,
                contentWithout(article.content, mediaId),
                now
              ),
              {
                onNone: () => Effect.void,
                onSome: (detached) =>
                  articles
                    .update(detached, article)
                    .pipe(
                      Effect.flatMap((written) =>
                        written
                          ? Effect.void
                          : Effect.die("An article changed under its row lock")
                      )
                    ),
              }
            )
          )
        );

      const usage = Effect.fn("MediaInArticles.usage")(function* usage(
        workspaceId: WorkspaceId,
        mediaId: MediaAssetId
      ) {
        return articleUse(yield* articles.showing(workspaceId, mediaId));
      });

      const hold = Effect.fn("MediaInArticles.hold")(function* hold(
        workspaceId: WorkspaceId,
        mediaId: MediaAssetId
      ) {
        const showing = yield* articles.lockShowing(workspaceId, mediaId);

        const held: ArticleMediaHold = {
          // Once the media goes, the articles that may still be sent lose
          // it, as drafts do; one already on its site keeps the id it went
          // out with.
          letGo: Effect.forEach(
            showing,
            (article) => detachArticle(article, mediaId),
            { discard: true }
          ),
          scheduled: articleUse(showing).scheduled,
        };

        return held;
      });

      return MediaInArticles.of({ hold, usage });
    })
  );
}
