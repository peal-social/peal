import { and, asc, desc, eq } from "drizzle-orm";
import { DateTime, Effect, Layer, Schema } from "effect";

import { UsageRecords } from "#assistant/application/ports/usage-records.ts";
import {
  capabilityAddressOf,
  ConnectedProviderIdSchema,
} from "#assistant/domain/ai-capability.ts";
import {
  kindOfProvider,
  TextProviderIdSchema,
} from "#assistant/domain/text-provider.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import type {
  ImageProviderRecord,
  TextProviderRecord,
} from "#shared/application/personal-data.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import {
  capabilityModels,
  dailyUsage,
  imageProviders,
  ownAudioDays,
  ownImageDays,
  ownTextDays,
  providerConnections,
  slideshows,
  textProviders,
  videoGenerations,
} from "./schema.ts";

const instantOf = (date: Date | null) =>
  date === null ? null : DateTime.fromDateUnsafe(date);

const isKnownProvider = Schema.is(ConnectedProviderIdSchema);

const isTextProvider = Schema.is(TextProviderIdSchema);

// The use's address for an export, as its endpoint answered it: what the
// use adds to the connection's, for a provider this release knows.
const useAddressOf = (
  provider: string,
  capability: "image" | "text",
  address: string
) =>
  isKnownProvider(provider)
    ? capabilityAddressOf(provider, capability, address)
    : address;

const failed = (cause: unknown) => new DatabaseError({ cause });

/** UsageRecords on the assistant schema. */
export const DrizzleUsageRecordsLive = Layer.effect(
  UsageRecords,
  Effect.gen(function* DrizzleUsageRecords() {
    const db = yield* Drizzle;

    // What the workspace chose for a use, with its connection's address:
    // never the key.
    const chosen = (workspaceId: WorkspaceId, capability: "image" | "text") =>
      db
        .select({
          baseUrl: providerConnections.baseUrl,
          model: capabilityModels.model,
          provider: capabilityModels.provider,
          updatedAt: capabilityModels.updatedAt,
        })
        .from(capabilityModels)
        .innerJoin(
          providerConnections,
          and(
            eq(providerConnections.workspaceId, capabilityModels.workspaceId),
            eq(providerConnections.provider, capabilityModels.provider)
          )
        )
        .where(
          and(
            eq(capabilityModels.workspaceId, workspaceId),
            eq(capabilityModels.capability, capability)
          )
        )
        .pipe(Effect.map(([row]) => row));

    return UsageRecords.of({
      eraseWorkspace: Effect.fn("UsageRecords.eraseWorkspace")(
        function* eraseWorkspace(workspaceId) {
          yield* db
            .delete(dailyUsage)
            .where(eq(dailyUsage.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(ownImageDays)
            .where(eq(ownImageDays.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(ownAudioDays)
            .where(eq(ownAudioDays.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(imageProviders)
            .where(eq(imageProviders.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(ownTextDays)
            .where(eq(ownTextDays.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(textProviders)
            .where(eq(textProviders.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          // The choices go with their connections (the foreign key).
          yield* db
            .delete(providerConnections)
            .where(eq(providerConnections.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          // A job still on its way finds its row gone, and ends as
          // superseded.
          yield* db
            .delete(videoGenerations)
            .where(eq(videoGenerations.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
          yield* db
            .delete(slideshows)
            .where(eq(slideshows.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
        }
      ),
      exportImageProvider: (workspaceId) =>
        chosen(workspaceId, "image").pipe(
          Effect.map((row) => {
            if (row === undefined) {
              return null;
            }

            const record: ImageProviderRecord = {
              baseUrl: useAddressOf(row.provider, "image", row.baseUrl),
              model: row.model,
              provider: row.provider,
              updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
            };

            return record;
          }),
          Effect.mapError(failed),
          Effect.withSpan("UsageRecords.exportImageProvider")
        ),
      exportModels: (workspaceId) =>
        db
          .select({
            capability: capabilityModels.capability,
            model: capabilityModels.model,
            provider: capabilityModels.provider,
            updatedAt: capabilityModels.updatedAt,
          })
          .from(capabilityModels)
          .where(eq(capabilityModels.workspaceId, workspaceId))
          .orderBy(asc(capabilityModels.capability))
          .pipe(
            Effect.map((rows) =>
              rows.map((row) => ({
                ...row,
                updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
              }))
            ),
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportModels")
          ),
      exportOwnImages: (workspaceId) =>
        db
          .select({ day: ownImageDays.day, images: ownImageDays.images })
          .from(ownImageDays)
          .where(eq(ownImageDays.workspaceId, workspaceId))
          .orderBy(asc(ownImageDays.day))
          .pipe(
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportOwnImages")
          ),
      exportVideos: (workspaceId) =>
        db
          .select()
          .from(videoGenerations)
          .where(eq(videoGenerations.workspaceId, workspaceId))
          .orderBy(desc(videoGenerations.createdAt), desc(videoGenerations.id))
          .pipe(
            Effect.map((rows) =>
              rows.map((row) => ({
                aspect: row.aspect,
                createdAt: DateTime.fromDateUnsafe(row.createdAt),
                durationSeconds: row.durationSeconds,
                finishedAt: instantOf(row.finishedAt),
                id: row.id,
                imageMediaId: row.imageMediaId,
                mediaId: row.mediaId,
                reason: row.reason,
                startedAt: instantOf(row.startedAt),
                status: row.status,
              }))
            ),
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportVideos")
          ),
      exportSlideshows: (workspaceId) =>
        db
          .select()
          .from(slideshows)
          .where(eq(slideshows.workspaceId, workspaceId))
          .orderBy(desc(slideshows.createdAt), desc(slideshows.id))
          .pipe(
            Effect.map((rows) =>
              rows.map((row) => ({
                aspect: row.aspect,
                createdAt: DateTime.fromDateUnsafe(row.createdAt),
                durationSeconds: row.durationSeconds,
                finishedAt: instantOf(row.finishedAt),
                id: row.id,
                imageMediaIds: row.imageMediaIds,
                mediaId: row.mediaId,
                reason: row.reason,
                sandbox: row.sandbox,
                startedAt: instantOf(row.startedAt),
                status: row.status,
                voiceoverMediaId: row.voiceoverMediaId,
              }))
            ),
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportSlideshows")
          ),
      exportOwnText: (workspaceId) =>
        db
          .select({ day: ownTextDays.day, requests: ownTextDays.requests })
          .from(ownTextDays)
          .where(eq(ownTextDays.workspaceId, workspaceId))
          .orderBy(asc(ownTextDays.day))
          .pipe(
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportOwnText")
          ),
      exportProviders: (workspaceId) =>
        db
          // Never the key, sealed or not.
          .select({
            baseUrl: providerConnections.baseUrl,
            provider: providerConnections.provider,
            updatedAt: providerConnections.updatedAt,
          })
          .from(providerConnections)
          .where(eq(providerConnections.workspaceId, workspaceId))
          .orderBy(asc(providerConnections.provider))
          .pipe(
            Effect.map((rows) =>
              rows.map((row) => ({
                ...row,
                updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
              }))
            ),
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportProviders")
          ),
      exportTextProvider: (workspaceId) =>
        chosen(workspaceId, "text").pipe(
          Effect.map((row) => {
            if (row === undefined) {
              return null;
            }

            const record: TextProviderRecord = {
              baseUrl: useAddressOf(row.provider, "text", row.baseUrl),
              kind: isTextProvider(row.provider)
                ? kindOfProvider(row.provider)
                : "openai-compatible",
              model: row.model,
              provider: row.provider,
              updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
            };

            return record;
          }),
          Effect.mapError(failed),
          Effect.withSpan("UsageRecords.exportTextProvider")
        ),
      exportWorkspace: (workspaceId) =>
        db
          .select({ day: dailyUsage.day, requests: dailyUsage.requests })
          .from(dailyUsage)
          .where(eq(dailyUsage.workspaceId, workspaceId))
          .orderBy(asc(dailyUsage.day))
          .pipe(
            Effect.mapError(failed),
            Effect.withSpan("UsageRecords.exportWorkspace")
          ),
    });
  })
);
