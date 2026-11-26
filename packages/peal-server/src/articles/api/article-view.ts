import { Match, Option } from "effect";
import type {
  Article as ArticleView,
  ArticleState as StateView,
  ArticleSummary as SummaryView,
} from "peal-contract";

import type { Article, ArticleState } from "#articles/domain/article.ts";
import type { Schedule } from "#shared/domain/schedule.ts";

const scheduledOf = (schedule: Schedule) => ({
  scheduledAt: schedule.at,
  timeZone: schedule.timeZone,
});

const stateView = (state: ArticleState): StateView =>
  Match.valueTags(state, {
    draft: (): StateView => ({ _tag: "draft" }),
    failed: ({ code, failedAt, reason, schedule }): StateView => ({
      _tag: "failed",
      ...scheduledOf(schedule),
      code: code ?? null,
      failedAt,
      reason,
    }),
    published: (published): StateView => ({
      _tag: "published",
      ...scheduledOf(published.schedule),
      editedAt: published.editedAt ?? null,
      permalink: published.permalink ?? null,
      platformPostId: published.platformPostId,
      publishedAt: published.publishedAt,
      removedAt: published.removedAt ?? null,
    }),
    publishing: ({ schedule, since }): StateView => ({
      _tag: "publishing",
      ...scheduledOf(schedule),
      since,
    }),
    scheduled: ({ schedule }): StateView => ({
      _tag: "scheduled",
      ...scheduledOf(schedule),
    }),
    unconfirmed: ({ attemptedAt, reason, schedule }): StateView => ({
      _tag: "unconfirmed",
      ...scheduledOf(schedule),
      attemptedAt,
      reason,
    }),
  });

/** An article as a list answers it: all but its body. */
export const articleSummaryView = (article: Article): SummaryView => ({
  authorId: Option.getOrNull(article.authorId),
  categories: article.content.categories,
  channelId: article.channelId,
  coverMediaId: Option.getOrNull(article.content.coverMediaId),
  createdAt: article.createdAt,
  excerpt: Option.getOrNull(article.content.excerpt),
  id: article.id,
  siteStatus: article.content.siteStatus,
  state: stateView(article.state),
  tags: article.content.tags,
  title: article.content.title,
  updatedAt: article.updatedAt,
});

/** An article as the API answers it. */
export const articleView = (article: Article): ArticleView => ({
  ...articleSummaryView(article),
  body: article.content.body,
});
