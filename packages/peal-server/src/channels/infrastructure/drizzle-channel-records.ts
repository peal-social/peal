import { asc, eq } from "drizzle-orm";
import {
  DateTime,
  Duration,
  Effect,
  Fiber,
  Layer,
  Metric,
  Option,
  Ref,
} from "effect";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { TokenCipher } from "#channels/application/token-cipher.ts";
import type { Channel } from "#channels/domain/channel.ts";
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
 * them go, all of them together: past it, the erasure goes on, and the
 * release goes on without it.
 */
export const releaseWait = Duration.seconds(10);

/**
 * How long a release goes on at most, outside the erasure: what is left
 * then is logged and counted (`channelsLeftSubscribed`).
 */
export const releaseLimit = Duration.minutes(2);

// The channels let go at once: a platform's two calls each.
const releaseConcurrency = 8;

/**
 * Channels of an erased workspace whose platform the release did not let
 * go: Meta goes on sending their accounts' message events, which the
 * server ignores, until the account's owner removes the app.
 */
export const channelsLeftSubscribed = Metric.counter(
  "peal.channels.release.left_subscribed",
  {
    description:
      "Channels of an erased workspace whose platform still sends their events",
    incremental: true,
  }
);

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

    // Every channel's tokens, read now, before the erasure deletes them;
    // they stay Redacted for the release to hold.
    const heldTokens = (channel: Channel) =>
      repository.credentials(channel.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (credentials) =>
              decryptTokens(credentials, channel.id).pipe(
                Effect.provideService(TokenCipher, cipher),
                Effect.map((tokens) => Option.some({ channel, tokens }))
              ),
          })
        ),
        Effect.catch(() =>
          Effect.logWarning(
            "Could not let a channel's platform go before an erasure"
          ).pipe(
            Effect.annotateLogs({ channelId: channel.id }),
            Effect.as(Option.none())
          )
        )
      );

    const releaseWorkspaces = Effect.fn("ChannelRecords.releaseWorkspaces")(
      function* releaseWorkspaces(workspaceIds: readonly WorkspaceId[]) {
        const listed = (yield* Effect.all(
          workspaceIds.map((workspaceId) => repository.list(workspaceId))
        )).flat();

        const leaving = listed.map(({ id }) => id);

        const held = (yield* Effect.forEach(listed, heldTokens, {
          concurrency: releaseConcurrency,
        })).flatMap(Option.toArray);

        const released = yield* Ref.make(new Set<string>());

        // Eight side by side, bounded as a whole; then each channel its
        // platform did not let go is logged by its id and counted.
        const releasing = Effect.forEach(
          held,
          ({ channel, tokens }) =>
            departures
              .departed(channel, tokens, leaving)
              .pipe(
                Effect.tap((outcome) =>
                  outcome === "done"
                    ? Ref.update(
                        released,
                        (done) => new Set([...done, channel.id])
                      )
                    : Effect.void
                )
              ),
          { concurrency: releaseConcurrency, discard: true }
        ).pipe(
          Effect.timeoutOption(releaseLimit),
          Effect.andThen(Ref.get(released)),
          Effect.flatMap((done) => {
            const left = held.filter(({ channel }) => !done.has(channel.id));

            return Metric.update(channelsLeftSubscribed, left.length).pipe(
              Effect.andThen(
                Effect.forEach(
                  left,
                  ({ channel }) =>
                    Effect.logWarning(
                      "A channel's platform still sends its events after an erasure"
                    ).pipe(Effect.annotateLogs({ channelId: channel.id })),
                  { discard: true }
                )
              )
            );
          })
        );

        // A fiber of its own, which outlives the request: the erasure
        // waits for it `releaseWait` at most, and never cuts it short.
        const fiber = yield* Effect.forkDetach(releasing);

        yield* Fiber.join(fiber).pipe(Effect.timeoutOption(releaseWait));
      },
      // Whatever the database says, the erasure goes on.
      Effect.catch(() =>
        Effect.logWarning(
          "Could not list a workspace's channels before its erasure"
        )
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
