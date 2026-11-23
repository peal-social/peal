import { and, count, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";

import { SlideshowStore } from "#assistant/application/ports/slideshow-store.ts";
import type {
  SlideshowOutcome,
  SlideshowStart,
} from "#assistant/application/ports/slideshow-store.ts";
import {
  Slideshow,
  SlideshowIdSchema,
  SlideshowPlanSchema,
} from "#assistant/domain/slideshow.ts";
import type { SlideshowId } from "#assistant/domain/slideshow.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { slideshows } from "./schema.ts";

type Row = typeof slideshows.$inferSelect;

// A job on its way holds the workspace's turn.
const onItsWay = ["queued", "running"];

const optionalDate = (date: Date | null) =>
  Option.fromNullishOr(date).pipe(Option.map(DateTime.fromDateUnsafe));

// What a row says, decoded: a row of a state, an aspect or a reason this
// release does not know is left out.
const decodeSlideshow = Schema.decodeUnknownOption(Slideshow);

const slideshowOf = (row: Row): Option.Option<Slideshow> =>
  decodeSlideshow({
    aspect: row.aspect,
    createdAt: DateTime.fromDateUnsafe(row.createdAt),
    durationSeconds: row.durationSeconds,
    finishedAt: optionalDate(row.finishedAt),
    id: row.id,
    imageMediaIds: row.imageMediaIds,
    mediaId: Option.fromNullishOr(row.mediaId),
    reason: Option.fromNullishOr(row.reason),
    requestedBy: Option.fromNullishOr(row.requestedBy),
    sandbox: row.sandbox,
    startedAt: optionalDate(row.startedAt),
    status: row.status,
    voiceoverMediaId: Option.fromNullishOr(row.voiceoverMediaId),
    workspaceId: row.workspaceId,
  });

// A slide plan as earlier releases wrote it, else an edit plan.
const decodePlan = Schema.decodeUnknownOption(SlideshowPlanSchema);

const encodePlan = Schema.encodeSync(SlideshowPlanSchema);

// The workspace's turn is another job's.
const busyWith = (id: string): SlideshowStart => ({
  _tag: "busy",
  slideshowId: SlideshowIdSchema.make(id),
});

/**
 * SlideshowStore in Postgres (`assistant.slideshows`): the partial unique
 * index on the workspace's job on its way decides who starts, an insert
 * that meets it does nothing, and every change of state is conditional on
 * the state read, so two runs never both take a job.
 */
export const DrizzleSlideshowsLive = Layer.effect(
  SlideshowStore,
  Effect.gen(function* DrizzleSlideshows() {
    const db = yield* Drizzle;

    const settled = (
      id: SlideshowId,
      outcome: SlideshowOutcome,
      now: DateTime.Utc
    ) =>
      db
        .update(slideshows)
        .set({
          finishedAt: DateTime.toDateUtc(now),
          mediaId: outcome._tag === "succeeded" ? outcome.mediaId : null,
          plan: null,
          reason: outcome._tag === "failed" ? outcome.reason : null,
          status: outcome._tag,
        })
        .where(and(eq(slideshows.id, id), inArray(slideshows.status, onItsWay)))
        .returning()
        .pipe(Effect.orDie);

    return SlideshowStore.of({
      claim: Effect.fn("SlideshowStore.claim")(function* claim(id, now) {
        const rows = yield* db
          .update(slideshows)
          .set({ startedAt: DateTime.toDateUtc(now), status: "running" })
          .where(and(eq(slideshows.id, id), eq(slideshows.status, "queued")))
          .returning()
          .pipe(Effect.orDie);

        return Option.fromUndefinedOr(rows[0]).pipe(
          Option.flatMap((row) =>
            Option.all({
              plan: decodePlan(row.plan),
              slideshow: slideshowOf(row),
            })
          )
        );
      }),
      countSince: Effect.fn("SlideshowStore.countSince")(
        function* countSince(workspaceId, since) {
          const rows = yield* db
            .select({ total: count() })
            .from(slideshows)
            .where(
              and(
                eq(slideshows.workspaceId, workspaceId),
                gte(slideshows.createdAt, DateTime.toDateUtc(since))
              )
            )
            .pipe(Effect.orDie);

          return rows[0]?.total ?? 0;
        }
      ),
      find: Effect.fn("SlideshowStore.find")(function* find(id) {
        const rows = yield* db
          .select()
          .from(slideshows)
          .where(eq(slideshows.id, id))
          .pipe(Effect.orDie);

        return Option.fromUndefinedOr(rows[0]).pipe(
          Option.flatMap(slideshowOf)
        );
      }),
      get: Effect.fn("SlideshowStore.get")(function* get(workspaceId, id) {
        const rows = yield* db
          .select()
          .from(slideshows)
          .where(
            and(eq(slideshows.id, id), eq(slideshows.workspaceId, workspaceId))
          )
          .pipe(Effect.orDie);

        return Option.fromUndefinedOr(rows[0]).pipe(
          Option.flatMap(slideshowOf)
        );
      }),
      list: Effect.fn("SlideshowStore.list")(
        function* list(workspaceId, status, limit) {
          const rows = yield* db
            .select()
            .from(slideshows)
            .where(
              and(
                eq(slideshows.workspaceId, workspaceId),
                status.pipe(
                  Option.map((wanted) => eq(slideshows.status, wanted)),
                  Option.getOrUndefined
                )
              )
            )
            .orderBy(desc(slideshows.createdAt), desc(slideshows.id))
            .limit(limit)
            .pipe(Effect.orDie);

          return rows.flatMap((row) => Option.toArray(slideshowOf(row)));
        }
      ),
      settle: Effect.fn("SlideshowStore.settle")(
        function* settle(id, outcome, now) {
          const rows = yield* settled(id, outcome, now);

          return Option.fromUndefinedOr(rows[0]).pipe(
            Option.flatMap(slideshowOf)
          );
        }
      ),
      start: Effect.fn("SlideshowStore.start")(function* start(
        slideshow,
        plan,
        { dailyLimit, dayStart, now, staleBefore }
      ) {
        const { workspaceId } = slideshow;

        // Jobs lost on their way give the workspace its turn back.
        const lost = yield* db
          .update(slideshows)
          .set({
            finishedAt: DateTime.toDateUtc(now),
            plan: null,
            reason: "interrupted",
            status: "failed",
          })
          .where(
            and(
              eq(slideshows.workspaceId, workspaceId),
              inArray(slideshows.status, onItsWay),
              lt(slideshows.createdAt, DateTime.toDateUtc(staleBefore))
            )
          )
          .returning()
          .pipe(Effect.orDie);

        const onItsWayNow = db
          .select({ id: slideshows.id })
          .from(slideshows)
          .where(
            and(
              eq(slideshows.workspaceId, workspaceId),
              inArray(slideshows.status, onItsWay)
            )
          )
          .limit(1)
          .pipe(Effect.orDie);

        const interrupted = lost.flatMap((row) =>
          Option.toArray(slideshowOf(row))
        );

        const busy = yield* onItsWayNow;

        if (busy[0] !== undefined) {
          return busyWith(busy[0].id);
        }

        const used = yield* db
          .select({ total: count() })
          .from(slideshows)
          .where(
            and(
              eq(slideshows.workspaceId, workspaceId),
              gte(slideshows.createdAt, DateTime.toDateUtc(dayStart))
            )
          )
          .pipe(Effect.orDie);

        if ((used[0]?.total ?? 0) >= dailyLimit) {
          const exhausted: SlideshowStart = { _tag: "exhausted" };

          return exhausted;
        }

        const inserted = yield* db
          .insert(slideshows)
          .values({
            aspect: slideshow.aspect,
            createdAt: DateTime.toDateUtc(slideshow.createdAt),
            durationSeconds: slideshow.durationSeconds,
            id: slideshow.id,
            imageMediaIds: [...slideshow.imageMediaIds],
            plan: encodePlan(plan),
            requestedBy: Option.getOrNull(slideshow.requestedBy),
            sandbox: slideshow.sandbox,
            status: slideshow.status,
            voiceoverMediaId: Option.getOrNull(slideshow.voiceoverMediaId),
            workspaceId,
          })
          .onConflictDoNothing()
          .returning({ id: slideshows.id })
          .pipe(Effect.orDie);

        // Another request took the turn between the read and the insert.
        if (inserted[0] === undefined) {
          const other = yield* onItsWayNow;

          return busyWith(other[0]?.id ?? slideshow.id);
        }

        const started: SlideshowStart = { _tag: "started", interrupted };

        return started;
      }),
    });
  })
);
