import { Effect } from "effect";

import type { MeteredUsage } from "#shared/application/metered-usage.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

import { claimOf } from "./outgoing-message-claim.ts";
import type { MessageStore } from "./ports/message-store.ts";
import type { PrivateReplyStore } from "./ports/private-reply-store.ts";
import { claimOfPrivateReply } from "./private-reply-claim.ts";

/**
 * Deletes what Peal keeps of a channel's direct messages (its switch, box,
 * conversations and the messages sent from Peal) and its private replies
 * that never set out, and gives back the outbound message of each that
 * never set out: it is not sent, so it is not billed. The private replies
 * that may have gone stay until their purge. Run it in a transaction,
 * which locks those rows until it ends, so a job about to begin one finds
 * it gone.
 */
export const forgetChannelMessages = (
  store: typeof MessageStore.Service,
  privateReplies: typeof PrivateReplyStore.Service,
  meters: typeof MeteredUsage.Service,
  channelId: ChannelId
) =>
  Effect.gen(function* forgetting() {
    const unsent = yield* store.unsentOf(channelId);
    const unsentReplies = yield* privateReplies.dropUnsent(channelId);

    yield* store.channelGone(channelId);

    yield* Effect.forEach(
      unsentReplies,
      (reply) => meters.giveBack(claimOfPrivateReply(reply)),
      { discard: true }
    );

    yield* Effect.forEach(
      unsent,
      (message) => meters.giveBack(claimOf(message)),
      {
        discard: true,
      }
    );
  }).pipe(Effect.withSpan("forgetChannelMessages"));
