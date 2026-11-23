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
import { revokeUnsharedGrant } from "#channels/application/grant-revocation.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
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
 * What the warning on a channel left subscribed names, for the operator to
 * reach its account once the channel is gone: its id, its platform, its
 * account's id there (a Page's, or an Instagram account's, a business
 * account's public id) and, on Instagram, its way in (`facebookLogin`
 * through a Page, `instagramLogin`). Never its tokens.
 */
const leftBehind = (channel: Channel) => ({
  accountId: channel.accountId,
  channelId: channel.id,
  platform: channel.platform,
  ...Option.match(channel.connection, {
    onNone: () => ({}),
    onSome: (connection) => ({ connection }),
  }),
});

/**
 * ChannelRecords on the channels schema. Needs the ChannelRepository, the
 * TokenCipher, ChannelDepartures and the PlatformAuthorizers, for what an
 * erasure lets go first: what the channels set up on their platforms, and
 * the grants no other channel shares.
 */
export const DrizzleChannelRecords = Layer.effect(
  ChannelRecords,
  Effect.gen(function* DrizzleChannelRecords() {
    const db = yield* Drizzle;
    const repository = yield* ChannelRepository;
    const cipher = yield* TokenCipher;
    const departures = yield* ChannelDepartures;
    const authorizers = yield* PlatformAuthorizers;

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
        // Each channel's platform also forgets the grant, where it takes it
        // and no channel staying shares the account (`revokeUnsharedGrant`),
        // beside the departure, under the same bounds.
        const releasing = Effect.forEach(
          held,
          ({ channel, tokens }) =>
            Effect.all(
              [
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
                revokeUnsharedGrant(channel, tokens, leaving).pipe(
                  Effect.provideService(ChannelRepository, repository),
                  Effect.provideService(PlatformAuthorizers, authorizers)
                ),
              ],
              { concurrency: 2, discard: true }
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
                    ).pipe(Effect.annotateLogs(leftBehind(channel))),
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
