import { eq } from "drizzle-orm";
import { DateTime, Effect, Layer, Option } from "effect";

import { DatabaseError } from "#shared/application/database-error.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";
import { BrowserAnalyticsConsents } from "#workspace/application/browser-analytics-consents.ts";

import { user } from "./auth-schema.generated.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

/**
 * The choice on Better Auth's user row, written with the server's own
 * Drizzle driver: Better Auth lets neither a sign-up nor `updateUser` set
 * it.
 */
export const DrizzleBrowserAnalyticsConsents = Layer.effect(
  BrowserAnalyticsConsents,
  Effect.gen(function* DrizzleBrowserAnalyticsConsentsLive() {
    const db = yield* Drizzle;

    return BrowserAnalyticsConsents.of({
      keep: Effect.fn("BrowserAnalyticsConsents.keep")(function* keep(
        userId,
        { choice, decidedAt }
      ) {
        yield* db
          .update(user)
          .set({
            browserAnalyticsConsent: choice,
            browserAnalyticsConsentAt: DateTime.toDateUtc(decidedAt),
          })
          .where(eq(user.id, userId))
          .pipe(Effect.mapError(failed));
      }),
      read: Effect.fn("BrowserAnalyticsConsents.read")(function* read(userId) {
        const [row] = yield* db
          .select({
            choice: user.browserAnalyticsConsent,
            decidedAt: user.browserAnalyticsConsentAt,
          })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)
          .pipe(Effect.mapError(failed));

        return row === undefined ||
          row.choice === null ||
          row.decidedAt === null
          ? Option.none()
          : Option.some({
              choice: row.choice,
              decidedAt: DateTime.makeUnsafe(row.decidedAt),
            });
      }),
    });
  })
);
