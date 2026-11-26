import { and, eq } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";

import { SiteFiles } from "#publishing/application/site-files.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import type { SiteFile } from "#shared/application/site-call-journal.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { siteFiles } from "./schema.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

const decodeMediaId = Schema.decodeUnknownEffect(MediaAssetIdSchema);

// The row of one file of one target.
const one = (targetId: string, mediaId: string) =>
  and(eq(siteFiles.targetId, targetId), eq(siteFiles.mediaId, mediaId));

/** SiteFiles on `publishing.site_files`. */
export const DrizzleSiteFiles = Layer.effect(
  SiteFiles,
  Effect.gen(function* DrizzleSiteFiles() {
    const db = yield* Drizzle;

    return SiteFiles.of({
      featuredRefused: (targetId, mediaId) =>
        db
          .update(siteFiles)
          .set({ featuredRefused: true })
          .where(one(targetId, mediaId))
          .pipe(Effect.mapError(failed), Effect.asVoid),
      forget: (targetId, mediaId) =>
        db
          .delete(siteFiles)
          .where(one(targetId, mediaId))
          .pipe(Effect.mapError(failed), Effect.asVoid),
      record: (targetId, mediaId, file) =>
        db
          .insert(siteFiles)
          .values({
            mediaId,
            siteMediaId: file.id,
            sourceUrl: file.sourceUrl,
            targetId,
          })
          .onConflictDoUpdate({
            set: { siteMediaId: file.id, sourceUrl: file.sourceUrl },
            target: [siteFiles.targetId, siteFiles.mediaId],
          })
          .pipe(Effect.mapError(failed), Effect.asVoid),
      sent: (targetId) =>
        db
          .select()
          .from(siteFiles)
          .where(eq(siteFiles.targetId, targetId))
          .pipe(
            Effect.mapError(failed),
            Effect.flatMap(
              Effect.forEach((row) =>
                decodeMediaId(row.mediaId).pipe(
                  Effect.orDie,
                  Effect.map((mediaId): readonly [MediaAssetId, SiteFile] => [
                    mediaId,
                    {
                      featuredRefused: row.featuredRefused,
                      id: row.siteMediaId,
                      sourceUrl: row.sourceUrl,
                    },
                  ])
                )
              )
            ),
            Effect.map((entries) => new Map(entries))
          ),
    });
  })
);
