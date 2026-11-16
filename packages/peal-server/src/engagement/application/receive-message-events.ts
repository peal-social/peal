import { Context, DateTime, Duration, Effect, Layer, Option } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";

import { MessageChannelsOfAccount } from "./ports/message-channels-of-account.ts";
import type {
  AccountChannel,
  EventPlatform,
} from "./ports/message-channels-of-account.ts";
import { MessageJobs } from "./ports/message-jobs.ts";
import { MessageStore } from "./ports/message-store.ts";

/**
 * What a platform's event says of an account's messages, and all Peal
 * reads of it: the account, a message's id, and whether its author took it
 * back. No field holds a text, a sender or a file: what Peal keeps of a
 * message comes from reading the box.
 */
export interface MessageEvent {
  readonly accountId: string;
  readonly deleted: boolean;
  readonly messageId: Option.Option<string>;
  readonly platform: EventPlatform;
}

/**
 * How a batch of events ended: `taken` when it moved at least one box
 * forward, `ignored` when no channel of Peal's reads the accounts it names.
 */
export type EventsOutcome = "ignored" | "taken";

/** The span of time one read of a box covers, however many events came. */
export const eventSlot = Duration.seconds(10);

/** The instant `at` falls in, floored to `eventSlot`. */
export const slotOf = (at: DateTime.Utc): DateTime.Utc => {
  const width = Duration.toMillis(eventSlot);
  const millis = DateTime.toEpochMillis(at);

  return DateTime.makeUnsafe(millis - (millis % width));
};

/**
 * Takes a platform's signed events about accounts' messages. For each
 * account they name, every channel of it whose messages are on (one a
 * workspace that connected it) has the messages its events say were taken
 * back deleted, its box's next read brought to now, and a read of its box
 * started, one a channel and slot: all in one transaction. Nothing here
 * checks a permission: the platform's signature is the authority, and an
 * event can do no more than this. A channel whose messages are off, or an
 * account no channel holds, is ignored. Members are told of new messages
 * by the read, as always.
 */
export class ReceiveMessageEvents extends Context.Service<
  ReceiveMessageEvents,
  {
    readonly receive: (
      events: readonly MessageEvent[]
    ) => Effect.Effect<EventsOutcome, DatabaseError>;
  }
>()("peal-server/engagement/application/ReceiveMessageEvents") {
  static readonly layer = Layer.effect(
    ReceiveMessageEvents,
    Effect.gen(function* ReceiveMessageEventsLive() {
      const accounts = yield* MessageChannelsOfAccount;
      const store = yield* MessageStore;
      const jobs = yield* MessageJobs;
      const { transaction } = yield* TransactionRunner;

      // One channel's turn: false when its messages are off.
      const nudge = Effect.fn("ReceiveMessageEvents.nudge")(function* nudge(
        channel: AccountChannel,
        takenBack: ReadonlySet<string>,
        now: DateTime.Utc
      ) {
        // The update holds the box's row until the transaction ends, as
        // `lockBox` does: the deletions below are made under it.
        if (!(yield* store.bringForward(channel.channelId, now))) {
          return false;
        }

        for (const messageId of takenBack) {
          yield* store.deleteTakenBack(channel.channelId, messageId);
        }

        yield* jobs.readBox(channel.channelId, slotOf(now));

        return true;
      });

      const receive = Effect.fn("ReceiveMessageEvents.receive")(
        function* receive(events: readonly MessageEvent[]) {
          const now = yield* DateTime.now;

          // By account, with the messages each says were taken back.
          const byAccount = new Map<
            string,
            {
              readonly accountId: string;
              readonly platform: EventPlatform;
              readonly takenBack: Set<string>;
            }
          >();

          for (const event of events) {
            const key = `${event.platform}:${event.accountId}`;

            const account = byAccount.get(key) ?? {
              accountId: event.accountId,
              platform: event.platform,
              takenBack: new Set<string>(),
            };

            if (event.deleted && Option.isSome(event.messageId)) {
              account.takenBack.add(event.messageId.value);
            }

            byAccount.set(key, account);
          }

          return yield* transaction(
            Effect.gen(function* taking() {
              const channels: {
                readonly channel: AccountChannel;
                readonly takenBack: ReadonlySet<string>;
              }[] = [];

              for (const account of byAccount.values()) {
                for (const channel of yield* accounts.channelsOf(
                  account.platform,
                  account.accountId
                )) {
                  channels.push({ channel, takenBack: account.takenBack });
                }
              }

              // Boxes are taken in the order of their channels' ids, so two
              // batches that name the same accounts never wait on each other.
              let taken = false;

              for (const { channel, takenBack } of channels.toSorted(
                (left, right) =>
                  left.channel.channelId.localeCompare(right.channel.channelId)
              )) {
                taken = (yield* nudge(channel, takenBack, now)) || taken;
              }

              return taken ? ("taken" as const) : ("ignored" as const);
            })
          );
        }
      );

      return ReceiveMessageEvents.of({ receive });
    })
  );
}
