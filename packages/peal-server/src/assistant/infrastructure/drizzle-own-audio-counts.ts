import { and, eq, lt, sql } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";

import { OwnAudioCounts } from "#assistant/application/ports/own-audio-counts.ts";
import { isoDay } from "#assistant/infrastructure/drizzle-assistant-usage.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { ownAudioDays } from "./schema.ts";

/**
 * OwnAudioCounts in Postgres: one insert that adds one to the day's count
 * of the use while it stays within the limit, so requests sent together
 * never pass it.
 */
export const DrizzleOwnAudioCountsLive = Layer.effect(
  OwnAudioCounts,
  Effect.gen(function* DrizzleOwnAudioCounts() {
    const db = yield* Drizzle;

    return OwnAudioCounts.of({
      claim: Effect.fn("OwnAudioCounts.claim")(
        function* claim(workspaceId, capability, day, dailyLimit) {
          if (dailyLimit < 1) {
            return Option.none();
          }

          const rows = yield* db
            .insert(ownAudioDays)
            .values({ capability, count: 1, day: isoDay(day), workspaceId })
            .onConflictDoUpdate({
              set: { count: sql`${ownAudioDays.count} + 1` },
              setWhere: lt(ownAudioDays.count, dailyLimit),
              target: [
                ownAudioDays.workspaceId,
                ownAudioDays.day,
                ownAudioDays.capability,
              ],
            })
            .returning({ count: ownAudioDays.count })
            .pipe(Effect.orDie);

          return Option.fromUndefinedOr(rows[0]).pipe(
            Option.map(({ count }) => count)
          );
        }
      ),
      countOn: Effect.fn("OwnAudioCounts.countOn")(
        function* countOn(workspaceId, capability, day) {
          const rows = yield* db
            .select({ count: ownAudioDays.count })
            .from(ownAudioDays)
            .where(
              and(
                eq(ownAudioDays.workspaceId, workspaceId),
                eq(ownAudioDays.day, isoDay(day)),
                eq(ownAudioDays.capability, capability)
              )
            )
            .pipe(Effect.orDie);

          return rows[0]?.count ?? 0;
        }
      ),
    });
  })
);
