import { Effect, Option } from "effect";

import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";

/**
 * A store of private replies that holds none, for the worlds of other use
 * cases: what a channel's messages turned off, or the retention, would
 * delete of them is tested on the private replies' own world and on
 * Postgres.
 */
export const noPrivateReplies = PrivateReplyStore.of({
  advance: () => Effect.succeed(false),
  claimCall: () => Effect.succeed(false),
  dropIfForgotten: () => Effect.succeed(false),
  dropUnsent: () => Effect.succeed([]),
  handOver: () => Effect.succeed(Option.none()),
  journal: () => Effect.succeed({ _tag: "dropped" }),
  madeWithKey: () => Effect.succeed(Option.none()),
  ofComments: () => Effect.succeed([]),
  privateReply: () => Effect.succeed(Option.none()),
  purge: () => Effect.succeed(0),
  sentIdsOf: () => Effect.succeed([]),
  stranded: () => Effect.succeed([]),
});
