import {
  Cause,
  Duration,
  Effect,
  Layer,
  Option,
  Predicate,
  Schema,
} from "effect";
import { SqlClient, SqlError } from "effect/sql";

import { ChannelMoves } from "#channels/application/channel-moves.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { PostRecords } from "#publishing/application/post-records.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { AccountConnectedThere } from "#workspace/application/account-connected-there.ts";
import { ChannelMover } from "#workspace/application/channel-mover.ts";
import type { MovedChannel } from "#workspace/application/channel-mover.ts";
import { CustomerChannelNotFound } from "#workspace/application/customer-channel-not-found.ts";
import { WorkspaceBusy } from "#workspace/application/workspace-busy.ts";

const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);

/**
 * The longest a move waits for a row or a hold another request has (an
 * erasure's workspace, a post's targets, the additions): it holds a
 * channel lock meanwhile, of the few a process has.
 */
export const moveLockTimeout = Duration.seconds(5);

// Whether Postgres gave up waiting for a lock (`lock_timeout`), however
// deep in the error it is told.
const isLockTimeout = (failure: DatabaseError): boolean => {
  let cause: unknown = failure.cause;

  for (let depth = 0; depth < 5 && cause !== undefined; depth += 1) {
    if (
      SqlError.isSqlError(cause) &&
      cause.reason._tag === "LockTimeoutError"
    ) {
      return true;
    }

    // Drizzle's errors hold an Effect Cause, whose error is the next.
    if (Cause.isCause(cause)) {
      cause = Option.getOrUndefined(Cause.findErrorOption(cause));
    } else {
      cause = Predicate.hasProperty(cause, "cause") ? cause.cause : undefined;
    }
  }

  return false;
};

/**
 * ChannelMover through the channels context's ChannelMoves, once
 * publishing says no call is in flight through the channel for the
 * workspace it leaves (`PostRecords.ensureChannelIdle`), which holds its
 * posts' targets on the channel until the move commits: a post that comes
 * due meanwhile then finds the channel gone, as after a disconnection.
 * Waits on locks are bounded (`moveLockTimeout`), and one that runs out is
 * `WorkspaceBusy`, as for a call in flight. A
 * token that does not open, or a server without its keys, is the server's
 * own failure.
 */
export const ContextChannelMoverLive = Layer.effect(
  ChannelMover,
  Effect.gen(function* ContextChannelMover() {
    const moves = yield* ChannelMoves;
    const posts = yield* PostRecords;
    const engagement = yield* EngagementRecords;
    const sql = yield* SqlClient.SqlClient;

    // For the rest of the move's transaction.
    const boundWaits = sql
      .unsafe(
        `SET LOCAL lock_timeout = '${String(Duration.toMillis(moveLockTimeout))}ms'`
      )
      .pipe(Effect.mapError((cause) => new DatabaseError({ cause })));

    return ChannelMover.of({
      move: ({ channelId, from, inside, to }) =>
        Option.match(decodeChannelId(channelId), {
          onNone: () => Effect.fail(new CustomerChannelNotFound()),
          onSome: (id) =>
            moves
              .move({
                channelId: id,
                from,
                inside: boundWaits.pipe(
                  Effect.andThen(inside),
                  Effect.andThen(
                    posts.ensureChannelIdle(from, id).pipe(
                      Effect.andThen(engagement.ensureChannelIdle(from, id)),
                      Effect.catchTags({
                        PostsPublishing: () =>
                          Effect.fail(new WorkspaceBusy({ workspaceId: from })),
                        SendsInFlight: () =>
                          Effect.fail(new WorkspaceBusy({ workspaceId: from })),
                      })
                    )
                  )
                ),
                to,
              })
              .pipe(
                Effect.map((channel): MovedChannel => ({
                  avatarUrl: channel.avatarUrl,
                  connection: channel.connection,
                  displayName: channel.displayName,
                  handle: channel.handle,
                  id: channel.id,
                  platform: channel.platform,
                  status: channel.status,
                  tokenExpiresAt:
                    channel.token._tag === "nonRefreshable"
                      ? Option.some(channel.token.expiresAt)
                      : Option.none(),
                })),
                Effect.catchTags({
                  // Another request held a row or a hold too long.
                  DatabaseError: (failure) =>
                    Effect.fail(
                      isLockTimeout(failure)
                        ? new WorkspaceBusy({ workspaceId: from })
                        : failure
                    ),
                  ChannelAccountTaken: ({ channelId: there }) =>
                    Effect.fail(
                      new AccountConnectedThere({ channelId: there })
                    ),
                  ChannelNotFound: () =>
                    Effect.fail(new CustomerChannelNotFound()),
                  MalformedEncryptedToken: Effect.die,
                  MissingTokenKey: Effect.die,
                  TokenAuthenticationFailed: Effect.die,
                  UnknownTokenKey: Effect.die,
                })
              ),
        }),
    });
  })
);
