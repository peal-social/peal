import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  doublePrecision,
  index,
  boolean,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Like every context, the assistant keeps its tables in a Postgres schema of
// its own.
export const assistant = pgSchema("assistant");

// How many requests each workspace sent the assistant on each UTC day: the
// daily quota reads today's row, and billing can read them all. A row holds
// counts only, never what was asked or answered.
export const dailyUsage = assistant.table(
  "daily_usage",
  {
    day: date("day", { mode: "string" }).notNull(),
    requests: integer("requests").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.day] }),
    check("daily_usage_requests", sql`${table.requests} >= 0`),
  ]
);

/**
 * The image provider a workspace brought, one at most: its address and
 * model, and its key, encrypted with the server's keyring as
 * `<keyId>.<iv>.<ciphertext>` and bound to
 * `assistant:<workspace id>:<address>`, so a row whose address changed
 * in any way, or that was copied to another workspace, does not decrypt.
 * `key_id` names the key that encrypted it, for a rotation. Who saved it
 * is the activity log's to say, not this row's.
 */
export const imageProviders = assistant.table("image_providers", {
  baseUrl: text("base_url").notNull(),
  keyId: text("key_id").notNull(),
  model: text("model").notNull(),
  // The provider by name; null on a row saved before providers had names,
  // which reads as `openai-compatible`, the only API the release before
  // speaks.
  provider: text("provider"),
  sealedKey: text("sealed_key").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  workspaceId: uuid("workspace_id").primaryKey(),
});

// How many images each workspace asked its own provider for each UTC day,
// bounded by `ownImagesPerDay`: counts only, apart from Peal's requests,
// which billing reads.
export const ownImageDays = assistant.table(
  "own_image_days",
  {
    day: date("day", { mode: "string" }).notNull(),
    images: integer("images").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.day] }),
    check("own_image_days_images", sql`${table.images} >= 0`),
  ]
);

// How many voice-overs (`speech`) and transcripts (`transcription`) each
// workspace asked its own providers for each UTC day, bounded by
// `voiceoversPerDay` and `transcriptionsPerDay`: counts only, never what
// was said.
export const ownAudioDays = assistant.table(
  "own_audio_days",
  {
    capability: text("capability").notNull(),
    count: integer("count").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.day, table.capability],
    }),
    check("own_audio_days_count", sql`${table.count} >= 0`),
  ]
);

/**
 * The text provider a workspace brought, one at most: the API it speaks
 * (`anthropic` or `openai-compatible`), its address and model, and its
 * key, encrypted with the server's keyring as `<keyId>.<iv>.<ciphertext>`
 * and bound to `assistant:text:<workspace id>:<address>`, so a row whose
 * address changed in any way, or that was copied to another workspace or
 * from the image provider's, does not decrypt. `key_id` names the key that
 * encrypted it, for a rotation. Who saved it is the activity log's to say.
 */
export const textProviders = assistant.table(
  "text_providers",
  {
    baseUrl: text("base_url").notNull(),
    keyId: text("key_id").notNull(),
    // The API it speaks, still written for the release before, which reads
    // it alone.
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    // The provider by name; null on a row saved before providers had
    // names, which reads as its kind's.
    provider: text("provider"),
    sealedKey: text("sealed_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    workspaceId: uuid("workspace_id").primaryKey(),
  },
  (table) => [
    check(
      "text_providers_kind",
      sql`${table.kind} IN ('anthropic', 'openai-compatible')`
    ),
  ]
);

// How many requests each workspace sent its own text provider each UTC
// day, bounded by `ownTextRequestsPerDay`: counts only, apart from Peal's
// requests, which billing reads.
export const ownTextDays = assistant.table(
  "own_text_days",
  {
    day: date("day", { mode: "string" }).notNull(),
    requests: integer("requests").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.day] }),
    check("own_text_days_requests", sql`${table.requests} >= 0`),
  ]
);

/**
 * The providers a workspace connected, one row a provider: where it is
 * reached (its own address, or a proxy's) and its key, encrypted with the
 * server's keyring as `<keyId>.<iv>.<ciphertext>` and bound to
 * `assistant:provider:<workspace id>:<provider>:<address>`, so a row whose
 * address changed in any way, or that was copied to another workspace or
 * provider, does not decrypt. `key_id` names the key that encrypted it,
 * for a rotation. What it serves is `capability_models`' to say; who saved
 * it, the activity log's.
 */
export const providerConnections = assistant.table(
  "provider_connections",
  {
    baseUrl: text("base_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    keyId: text("key_id").notNull(),
    provider: text("provider").notNull(),
    sealedKey: text("sealed_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.provider] })]
);

/**
 * What a workspace chose for each of its uses (`text`, `image`; later
 * ones join), one row a use: a provider it connected and the model asked.
 * Removing the connection removes the uses it served. Which uses a
 * provider offers is the catalogue's to say, never a row's.
 */
export const capabilityModels = assistant.table(
  "capability_models",
  {
    capability: text("capability").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.capability] }),
    foreignKey({
      columns: [table.workspaceId, table.provider],
      foreignColumns: [
        providerConnections.workspaceId,
        providerConnections.provider,
      ],
      name: "capability_models_connection",
    }).onDelete("cascade"),
  ]
);

/**
 * The videos workspaces asked for, one row a job: who asked (a member, or
 * none for a key), the aspect, the length, the first frame, and where it
 * stands (`queued`, `running`, `succeeded` with the file it made,
 * `failed` with why). The prompt is kept only while the job is on its
 * way, then erased. One job a workspace is on its way at a time
 * (`video_generations_one_at_a_time`, which the database decides). Ids of
 * other contexts have no foreign key: erasing a workspace deletes its
 * rows. Instants are written from the Clock.
 */
export const videoGenerations = assistant.table(
  "video_generations",
  {
    aspect: text("aspect").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").primaryKey(),
    imageMediaId: uuid("image_media_id"),
    mediaId: uuid("media_id"),
    prompt: text("prompt"),
    reason: text("reason"),
    requestedBy: uuid("requested_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: text("status").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    uniqueIndex("video_generations_one_at_a_time")
      .on(table.workspaceId)
      .where(sql`${table.status} IN ('queued', 'running')`),
    index("video_generations_workspace").on(
      table.workspaceId,
      table.createdAt.desc()
    ),
  ]
);

/**
 * The slide videos workspaces asked for, one row a job: who asked (a
 * member, or none for a key), the aspect, the length, the images in order,
 * the voice-over, whether the service's sandbox composes it, and where it
 * stands (`queued`, `running`, `succeeded` with the file it made, `failed`
 * with why). The plan, with the captions, is kept only while the job is on
 * its way, then erased. One job a workspace is on its way at a time
 * (`slideshows_one_at_a_time`, which the database decides). Ids of other
 * contexts have no foreign key: erasing a workspace deletes its rows.
 * Instants are written from the Clock.
 */
export const slideshows = assistant.table(
  "slideshows",
  {
    aspect: text("aspect").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    durationSeconds: doublePrecision("duration_seconds").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    id: uuid("id").primaryKey(),
    imageMediaIds: uuid("image_media_ids").array().notNull(),
    mediaId: uuid("media_id"),
    plan: jsonb("plan"),
    reason: text("reason"),
    requestedBy: uuid("requested_by"),
    sandbox: boolean("sandbox").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: text("status").notNull(),
    voiceoverMediaId: uuid("voiceover_media_id"),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    uniqueIndex("slideshows_one_at_a_time")
      .on(table.workspaceId)
      .where(sql`${table.status} IN ('queued', 'running')`),
    index("slideshows_workspace").on(table.workspaceId, table.createdAt.desc()),
  ]
);
