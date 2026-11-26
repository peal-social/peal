import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";

import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import { PlatformSchema, socialPlatforms } from "#channels/domain/platform.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import {
  ChannelConnectionSchema,
  connectionOf,
} from "#shared/domain/channel-connection.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { channels } from "./schema.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

const decodeListed = Schema.decodeUnknownEffect(
  Schema.Array(
    Schema.Struct({
      channelId: ChannelIdSchema,
      platform: PlatformSchema,
      workspaceId: WorkspaceIdSchema,
    })
  )
);

const decodeOfAccount = Schema.decodeUnknownEffect(
  Schema.Array(
    Schema.Struct({
      channelId: ChannelIdSchema,
      connection: Schema.NullOr(ChannelConnectionSchema),
      platform: PlatformSchema,
      workspaceId: WorkspaceIdSchema,
    })
  )
);

/** ChannelDirectory on the channels table, by its primary key. */
export const DrizzleChannelDirectory = Layer.effect(
  ChannelDirectory,
  Effect.gen(function* DrizzleChannelDirectory() {
    const db = yield* Drizzle;

    return ChannelDirectory.of({
      after: Effect.fn("ChannelDirectory.after")(function* after(last, limit) {
        const rows = yield* (
          db
            .select({
              channelId: channels.id,
              platform: channels.platform,
              workspaceId: channels.workspaceId,
            })
            .from(channels)
            // No website's: analytics and the inbox follow none of them,
            // and the release before cannot read one in their tables.
            .where(
              and(
                inArray(channels.platform, [...socialPlatforms]),
                last.pipe(
                  Option.map((id) => gt(channels.id, id)),
                  Option.getOrUndefined
                )
              )
            )
            .orderBy(asc(channels.id))
            .limit(limit)
            .pipe(Effect.mapError(failed))
        );

        return yield* decodeListed(rows).pipe(Effect.orDie);
      }),
      withAccount: Effect.fn("ChannelDirectory.withAccount")(
        function* withAccount(platform, accountId) {
          const rows = yield* db
            .select({
              channelId: channels.id,
              connection: channels.connection,
              platform: channels.platform,
              workspaceId: channels.workspaceId,
            })
            .from(channels)
            .where(
              and(
                eq(channels.platform, platform),
                eq(channels.accountId, accountId)
              )
            )
            .orderBy(asc(channels.id))
            .pipe(Effect.mapError(failed));

          const listed = yield* decodeOfAccount(rows).pipe(Effect.orDie);

          // One stored without a way in came the first way there was.
          return listed.map((channel) => ({
            ...channel,
            connection: connectionOf(
              channel.platform,
              Option.fromNullOr(channel.connection)
            ),
          }));
        }
      ),
    });
  })
);
