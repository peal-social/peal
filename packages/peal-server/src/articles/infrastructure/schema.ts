import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { publishing } from "#shared/infrastructure/publishing-schema.ts";

// The articles context's tables. They stay in the Postgres schema
// `publishing`, where they were made before articles had a context of
// their own: moving them would be a migration for no gain. They are
// declared on the kernel's one `pgSchema("publishing")` object, as
// drizzle-kit refuses a schema name declared twice. Instants are
// timestamptz written from the Clock (never NOW()), so tests control them.

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * A workspace's articles, each for one of its websites (a channel of a
 * site's platform). `body` is the editor's document (JSON the domain's
 * `ArticleBodySchema` decodes), `tags` and `categories` the names the
 * site shows, `site_status` how it lands there (`publish`, `draft`,
 * `future`). `state` is the domain's `ArticleState` JSON (persisted
 * contract), `status` its tag and `scheduled_at`, `schedule_zone` its
 * schedule, for the queries. `revision` changes with every schedule and
 * `round` with every new try, which the job's key holds. `author_id` is
 * the member who made it (a Better Auth user id), null for an API key.
 * `media_ids` lists the library's files it shows, its cover and the
 * body's images, for the library's check before it deletes one. Rows go
 * with their workspace.
 */
export const articles = publishing.table(
  "articles",
  {
    authorId: uuid("author_id"),
    body: jsonb("body").notNull(),
    categories: jsonb("categories").notNull().default([]),
    channelId: uuid("channel_id").notNull(),
    coverMediaId: uuid("cover_media_id"),
    createdAt: instant("created_at").notNull(),
    excerpt: text("excerpt"),
    id: uuid("id").primaryKey(),
    mediaIds: uuid("media_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    revision: integer("revision").notNull().default(0),
    round: integer("round").notNull().default(0),
    scheduleZone: text("schedule_zone"),
    scheduledAt: instant("scheduled_at"),
    siteStatus: text("site_status").notNull(),
    state: jsonb("state").notNull(),
    status: text("status").notNull(),
    tags: jsonb("tags").notNull().default([]),
    title: text("title").notNull(),
    updatedAt: instant("updated_at").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    // A workspace's articles, newest first, page by page.
    index("articles_workspace").on(table.workspaceId, table.id),
    // The articles waiting to go out, in every workspace, by their time.
    index("articles_scheduled")
      .on(table.scheduledAt)
      .where(sql`${table.status} = 'scheduled'`),
    // A channel's articles: the posts they made on its site.
    index("articles_channel").on(table.channelId),
    // The articles that show a file of the library.
    index("articles_media").using("gin", table.mediaIds),
  ]
);

/**
 * The journal of calls that send an article to its site, as
 * `publication_calls` is the posts': a row is written, and committed,
 * before the call; `finished_at` and `outcome` (the domain's
 * `AttemptOutcome` JSON) once the site answered. A row with no
 * `finished_at` is a call whose fate is unknown, which a later run looks
 * for on the site rather than send again. `committed_at` is written just
 * before the call that makes the post: a row without it never reached
 * the site, and its attempt is made again. One row per attempt in a
 * round. Ids and codes only, never content. Rows go with their article.
 */
export const articleCalls = publishing.table(
  "article_calls",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    committedAt: instant("committed_at"),
    finishedAt: instant("finished_at"),
    idempotencyKey: text("idempotency_key").primaryKey(),
    outcome: jsonb("outcome"),
    round: integer("round").notNull(),
    startedAt: instant("started_at").notNull(),
  },
  (table) => [
    unique("article_calls_article_round_attempt").on(
      table.articleId,
      table.round,
      table.attempt
    ),
  ]
);

/**
 * The files an article sent to its site: the site's id and address for
 * each of the library's files, so a later attempt, or an update, sends
 * none twice. Rows go with their article.
 */
export const articleFiles = publishing.table(
  "article_files",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull(),
    // The site dropped it as the post's featured image, even sent again:
    // it is not offered as one any more.
    featuredRefused: boolean("featured_refused").notNull().default(false),
    siteMediaId: bigint("site_media_id", { mode: "number" }).notNull(),
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.mediaId] })]
);
