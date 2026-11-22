import { Cron, Duration, Effect } from "effect";
import { ClusterCron } from "effect/cluster";

import { AgentRecords } from "#agent/application/agent-records.ts";

/**
 * Every day at 04:31 UTC: deletes the chats with the agent whose last
 * message is over 90 days old, with their messages. A failed run is
 * logged and the next day's catches up.
 */
export const AgentRetentionCron = ClusterCron.make({
  cron: Cron.parseUnsafe("31 4 * * *", "UTC"),
  execute: AgentRecords.use((records) => records.purge).pipe(
    Effect.tap((chats) =>
      chats > 0
        ? Effect.logInfo("Deleted the agent's chats past their retention", {
            chats,
          })
        : Effect.void
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning(
        "Deleting the agent's chats past their retention failed",
        cause
      )
    )
  ),
  name: "agent.retention",
  skipIfOlderThan: Duration.hours(12),
});
