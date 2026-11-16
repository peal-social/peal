import { asc, eq } from "drizzle-orm";
import { DateTime, Duration, Effect, Layer, Option } from "effect";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { TokenCipher } from "#channels/application/token-cipher.ts";
import { userStarter } from "#channels/domain/connect-attempt.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import {
  channels,
  connectAttempts,
  connectChoices,
  connectLinks,
} from "./schema.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

/**
 * How long an erasure waits at most for its channels' platforms to let
 * them go, all of them together.
 */
export const releaseWait = Duration.seconds(10);

// The channels let go at once: a platform's two calls each.
const releaseConcurrency = 8;

/**
 * ChannelRecords on the channels schema. Needs the ChannelRepository, the
 * TokenCipher and ChannelDepartures, for what an erasure lets go first.
 */
export const DrizzleChannelRecords = Layer.effect(
  ChannelRecords,
  Effect.gen(function* DrizzleChannelRecords() {
    const db = yield* Drizzle;
    const repository = yield* ChannelRepository;
    const cipher = yield* TokenCipher;
    const departures = yield* ChannelDepartures;

    const releaseWorkspaces = Effect.fn("ChannelRecords.releaseWorkspaces")(
      function* releaseWorkspaces(workspaceIds: readonly WorkspaceId[]) {
        const listed = (yield* Effect.all(
          workspaceIds.map((workspaceId) => repository.list(workspaceId))
        )).flat();

        const leaving = listed.map(({ id }) => id);

        yield* Effect.forEach(
          listed,
          (channel) =>
            repository.credentials(channel.id).pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.void,
                  onSome: (credentials) =>
                    decryptTokens(credentials, channel.id).pipe(
                      Effect.provideService(TokenCipher, cipher),
                      Effect.flatMap((tokens) =>
                        departures.departed(channel, tokens, leaving)
                      )
                    ),
                })
              ),
              Effect.catch(() =>
                Effect.logWarning(
                  "Could not let a channel's platform go before an erasure"
                ).pipe(Effect.annotateLogs({ channelId: channel.id }))
              )
            ),
          { concurrency: releaseConcurrency, discard: true }
        );
      },
      // Whatever the database says, the erasure goes on.
      Effect.catch(() =>
        Effect.logWarning(
          "Could not list a workspace's channels before its erasure"
        )
      ),
      // One bound for every channel: past it, what is left is the
      // platform's to forget, and the erasure goes on.
      Effect.timeoutOption(releaseWait),
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.logWarning(
              "Could not let every channel's platform go before an erasure in time"
            ),
          onSome: () => Effect.void,
        })
      )
    );

    return ChannelRecords.of({
      releaseWorkspaces,
      eraseUser: Effect.fn("ChannelRecords.eraseUser")(
        function* eraseUser(userId) {
          const starter = userStarter(userId);

          yield* db
            .delete(connectAttempts)
            .where(eq(connectAttempts.startedBy, starter))
            .pipe(Effect.mapError(failed));

          yield* db
            .delete(connectChoices)
            .where(eq(connectChoices.startedBy, starter))
            .pipe(Effect.mapError(failed));

          // The links they created stay their workspaces', without them.
          yield* db
            .update(connectLinks)
            .set({ createdBy: null })
            .where(eq(connectLinks.createdBy, starter))
            .pipe(Effect.mapError(failed));
        }
      ),
      eraseWorkspace: Effect.fn("ChannelRecords.eraseWorkspace")(
        function* eraseWorkspace(workspaceId) {
          yield* db
            .delete(connectAttempts)
            .where(eq(connectAttempts.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));

          // A choice holds the accounts' tokens, encrypted.
          yield* db
            .delete(connectChoices)
            .where(eq(connectChoices.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));

          // Its links open nothing more.
          yield* db
            .delete(connectLinks)
            .where(eq(connectLinks.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));

          yield* db
            .delete(channels)
            .where(eq(channels.workspaceId, workspaceId))
            .pipe(Effect.mapError(failed));
        }
      ),
      exportWorkspace: Effect.fn("ChannelRecords.exportWorkspace")(
        function* exportWorkspace(workspaceId) {
          const rows = yield* db
            .select({
              connection: channels.connection,
              createdAt: channels.createdAt,
              displayName: channels.displayName,
              handle: channels.handle,
              id: channels.id,
              label: channels.label,
              platform: channels.platform,
              status: channels.status,
            })
            .from(channels)
            .where(eq(channels.workspaceId, workspaceId))
            .orderBy(asc(channels.createdAt), asc(channels.id))
            .pipe(Effect.mapError(failed));

          return rows.map((row) => ({
            ...row,
            createdAt: DateTime.fromDateUnsafe(row.createdAt),
          }));
        }
      ),
    });
  })
);
