import { Context } from "effect";
import type { DateTime, Effect } from "effect";

import type { OutgoingMessageId } from "#engagement/domain/outgoing-message-id.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

/**
 * Starts the durable job that sends a message, and the one that reads a
 * channel's box now. Inside a TransactionRunner transaction a start
 * commits, or rolls back, with what the transaction writes, and the job
 * runs after the commit.
 */
export class MessageJobs extends Context.Service<
  MessageJobs,
  {
    readonly start: (messageId: OutgoingMessageId) => Effect.Effect<void>;
    /**
     * Stops the message's job for good, in a transaction with what hands
     * the message to a person, so the job cannot wake after. A job that
     * has ended is left as it is.
     */
    readonly cancel: (messageId: OutgoingMessageId) => Effect.Effect<void>;
    /**
     * Reads the channel's box as soon as the job runs: one job a channel
     * and `slot` (an instant on ten seconds), so a burst of events reads
     * it once.
     */
    readonly readBox: (
      channelId: ChannelId,
      slot: DateTime.Utc
    ) => Effect.Effect<void>;
  }
>()("peal-server/engagement/application/MessageJobs") {}
