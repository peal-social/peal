import { sql } from "drizzle-orm";
import { Effect, Layer } from "effect";

import { ChannelOverviewReads } from "#channels/application/channel-overview-reads.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { anyUuid } from "#shared/infrastructure/any-uuid.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { channels } from "./schema.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

const counted = (condition: ReturnType<typeof sql>) =>
  sql<number>`(count(*) FILTER (WHERE ${condition}))::int`;

/**
 * The channels' counts across workspaces, in one query, every id in one
 * parameter (`anyUuid`), on the index a workspace's channels lead with.
 */
export const DrizzleChannelOverviewReads = Layer.effect(
  ChannelOverviewReads,
  Effect.gen(function* DrizzleChannelOverviewReads() {
    const db = yield* Drizzle;

    return ChannelOverviewReads.of({
      statesIn: (workspaceIds) =>
        db
          .select({
            connected: sql<number>`count(*)::int`,
            off: counted(sql`${channels.status} = 'disabled'`),
            toReconnect: counted(sql`${channels.status} = 'refreshNeeded'`),
            workspaceId: channels.workspaceId,
          })
          .from(channels)
          .where(anyUuid(channels.workspaceId, workspaceIds))
          .groupBy(channels.workspaceId)
          .pipe(
            Effect.mapError(failed),
            Effect.map(
              (rows) =>
                new Map(
                  rows.map(({ workspaceId, ...counts }) => [
                    WorkspaceIdSchema.make(workspaceId),
                    counts,
                  ])
                )
            ),
            Effect.withSpan("ChannelOverviewReads.statesIn")
          ),
    });
  })
);
