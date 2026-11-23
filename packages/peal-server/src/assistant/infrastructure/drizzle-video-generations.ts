import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";

import { VideoGenerationStore } from "#assistant/application/ports/video-generation-store.ts";
import type {
  VideoOutcome,
  VideoStart,
} from "#assistant/application/ports/video-generation-store.ts";
import {
  VideoGeneration,
  VideoGenerationIdSchema,
  VideoPromptSchema,
} from "#assistant/domain/video-generation.ts";
import type { VideoGenerationId } from "#assistant/domain/video-generation.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { videoGenerations } from "./schema.ts";

type Row = typeof videoGenerations.$inferSelect;

// A job on its way holds the workspace's turn.
const onItsWay = ["queued", "running"];

const optionalDate = (date: Date | null) =>
  Option.fromNullishOr(date).pipe(Option.map(DateTime.fromDateUnsafe));

// What a row says, decoded: a row of a state, an aspect or a reason this
// release does not know is left out.
const decodeGeneration = Schema.decodeUnknownOption(VideoGeneration);

const generationOf = (row: Row): Option.Option<VideoGeneration> =>
  decodeGeneration({
    aspect: row.aspect,
    createdAt: DateTime.fromDateUnsafe(row.createdAt),
    durationSeconds: Option.fromNullishOr(row.durationSeconds),
    finishedAt: optionalDate(row.finishedAt),
    id: row.id,
    imageMediaId: Option.fromNullishOr(row.imageMediaId),
    mediaId: Option.fromNullishOr(row.mediaId),
    reason: Option.fromNullishOr(row.reason),
    requestedBy: Option.fromNullishOr(row.requestedBy),
    startedAt: optionalDate(row.startedAt),
    status: row.status,
    workspaceId: row.workspaceId,
  });

const decodePrompt = Schema.decodeUnknownOption(VideoPromptSchema);

// The workspace's turn is another job's.
const busyWith = (id: string): VideoStart => ({
  _tag: "busy",
  generationId: VideoGenerationIdSchema.make(id),
});

/**
 * VideoGenerationStore in Postgres (`assistant.video_generations`): the
 * partial unique index on the workspace's job on its way decides who
 * starts, an insert that meets it does nothing, and every change of state
 * is conditional on the state read, so two runs never both take a job.
 */
export const DrizzleVideoGenerationsLive = Layer.effect(
  VideoGenerationStore,
  Effect.gen(function* DrizzleVideoGenerations() {
    const db = yield* Drizzle;

    const settled = (
      id: VideoGenerationId,
      outcome: VideoOutcome,
      now: DateTime.Utc
    ) =>
      db
        .update(videoGenerations)
        .set({
          finishedAt: DateTime.toDateUtc(now),
          mediaId: outcome._tag === "succeeded" ? outcome.mediaId : null,
          prompt: null,
          reason: outcome._tag === "failed" ? outcome.reason : null,
          status: outcome._tag,
        })
        .where(
          and(
            eq(videoGenerations.id, id),
            inArray(videoGenerations.status, onItsWay)
          )
        )
        .returning()
        .pipe(Effect.orDie);

    return VideoGenerationStore.of({
      claim: Effect.fn("VideoGenerationStore.claim")(function* claim(id, now) {
        const rows = yield* db
          .update(videoGenerations)
          .set({ startedAt: DateTime.toDateUtc(now), status: "running" })
          .where(
            and(
              eq(videoGenerations.id, id),
              eq(videoGenerations.status, "queued")
            )
          )
          .returning()
          .pipe(Effect.orDie);

        return Option.fromUndefinedOr(rows[0]).pipe(
          Option.flatMap((row) =>
            Option.all({
              generation: generationOf(row),
              prompt: decodePrompt(row.prompt),
            })
          )
        );
      }),
      countSince: Effect.fn("VideoGenerationStore.countSince")(
        function* countSince(workspaceId, since) {
          const rows = yield* db
            .select({ total: count() })
            .from(videoGenerations)
            .where(
              and(
                eq(videoGenerations.workspaceId, workspaceId),
                gte(videoGenerations.createdAt, DateTime.toDateUtc(since))
              )
            )
            .pipe(Effect.orDie);

          return rows[0]?.total ?? 0;
        }
      ),
      find: Effect.fn("VideoGenerationStore.find")(function* find(id) {
        const rows = yield* db
          .select()
          .from(videoGenerations)
          .where(eq(videoGenerations.id, id))
          .pipe(Effect.orDie);

        return Option.fromUndefinedOr(rows[0]).pipe(
          Option.flatMap(generationOf)
        );
      }),
      get: Effect.fn("VideoGenerationStore.get")(
        function* get(workspaceId, id) {
          const rows = yield* db
            .select()
            .from(videoGenerations)
            .where(
              and(
                eq(videoGenerations.id, id),
                eq(videoGenerations.workspaceId, workspaceId)
              )
            )
            .pipe(Effect.orDie);

          return Option.fromUndefinedOr(rows[0]).pipe(
            Option.flatMap(generationOf)
          );
        }
      ),
      list: Effect.fn("VideoGenerationStore.list")(
        function* list(workspaceId, status, limit) {
          const rows = yield* db
            .select()
            .from(videoGenerations)
            .where(
              and(
                eq(videoGenerations.workspaceId, workspaceId),
                status.pipe(
                  Option.map((wanted) => eq(videoGenerations.status, wanted)),
                  Option.getOrUndefined
                )
              )
            )
            .orderBy(
              desc(videoGenerations.createdAt),
              desc(videoGenerations.id)
            )
            .limit(limit)
            .pipe(Effect.orDie);

          return rows.flatMap((row) => Option.toArray(generationOf(row)));
        }
      ),
      settle: Effect.fn("VideoGenerationStore.settle")(
        function* settle(id, outcome, now) {
          const rows = yield* settled(id, outcome, now);

          return Option.fromUndefinedOr(rows[0]).pipe(
            Option.flatMap(generationOf)
          );
        }
      ),
      start: Effect.fn("VideoGenerationStore.start")(function* start(
        generation,
        prompt,
        { dailyLimit, dayStart, now, staleBefore }
      ) {
        const { workspaceId } = generation;

        // Jobs lost on their way give the workspace its turn back.
        const lost = yield* db
          .update(videoGenerations)
          .set({
            finishedAt: DateTime.toDateUtc(now),
            prompt: null,
            reason: "interrupted",
            status: "failed",
          })
          .where(
            and(
              eq(videoGenerations.workspaceId, workspaceId),
              inArray(videoGenerations.status, onItsWay),
              lt(videoGenerations.createdAt, DateTime.toDateUtc(staleBefore))
            )
          )
          .returning()
          .pipe(Effect.orDie);

        const onItsWayNow = db
          .select({ id: videoGenerations.id })
          .from(videoGenerations)
          .where(
            and(
              eq(videoGenerations.workspaceId, workspaceId),
              inArray(videoGenerations.status, onItsWay)
            )
          )
          .limit(1)
          .pipe(Effect.orDie);

        const interrupted = lost.flatMap((row) =>
          Option.toArray(generationOf(row))
        );

        const busy = yield* onItsWayNow;

        if (busy[0] !== undefined) {
          return busyWith(busy[0].id);
        }

        const used = yield* db
          .select({ total: count() })
          .from(videoGenerations)
          .where(
            and(
              eq(videoGenerations.workspaceId, workspaceId),
              gte(videoGenerations.createdAt, DateTime.toDateUtc(dayStart))
            )
          )
          .pipe(Effect.orDie);

        if ((used[0]?.total ?? 0) >= dailyLimit) {
          const exhausted: VideoStart = { _tag: "exhausted" };

          return exhausted;
        }

        const inserted = yield* db
          .insert(videoGenerations)
          .values({
            aspect: generation.aspect,
            createdAt: DateTime.toDateUtc(generation.createdAt),
            durationSeconds: Option.getOrNull(generation.durationSeconds),
            id: generation.id,
            imageMediaId: Option.getOrNull(generation.imageMediaId),
            prompt,
            requestedBy: Option.getOrNull(generation.requestedBy),
            status: generation.status,
            workspaceId,
          })
          .onConflictDoNothing()
          .returning({ id: videoGenerations.id })
          .pipe(Effect.orDie);

        // Another request took the turn between the read and the insert.
        if (inserted[0] === undefined) {
          const other = yield* onItsWayNow;

          return busyWith(other[0]?.id ?? generation.id);
        }

        const started: VideoStart = { _tag: "started", interrupted };

        return started;
      }),
    });
  })
);
