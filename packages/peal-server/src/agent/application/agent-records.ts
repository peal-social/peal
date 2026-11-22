import { Context, DateTime, Effect, Layer } from "effect";

import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import type { ExportedChat } from "#agent/application/ports/agent-chats.ts";
import {
  chatRetentionDays,
  emptyChatRetentionHours,
} from "#agent/domain/run-limits.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/**
 * What the agent keeps about people, for the workspace context: a
 * person's chats in their export, and their erasure with a workspace, a
 * membership that ends, or an account that closes; and the retention,
 * which deletes a chat `chatRetentionDays` after its last message.
 * Erasures run in the caller's transaction.
 */
export class AgentRecords extends Context.Service<
  AgentRecords,
  {
    readonly exportUser: (
      userId: UserId
    ) => Effect.Effect<readonly ExportedChat[], DatabaseError>;
    readonly eraseWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError>;
    readonly eraseUser: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    readonly eraseMember: (
      workspaceId: WorkspaceId,
      userId: UserId
    ) => Effect.Effect<void, DatabaseError>;
    /** Deletes the chats past their retention; how many. */
    readonly purge: Effect.Effect<number, DatabaseError>;
  }
>()("peal-server/agent/application/AgentRecords") {
  static readonly layer = Layer.effect(
    AgentRecords,
    Effect.gen(function* AgentRecordsLive() {
      const chats = yield* AgentChats;

      return AgentRecords.of({
        eraseMember: (workspaceId, userId) =>
          chats
            .eraseMember({ userId, workspaceId })
            .pipe(Effect.withSpan("AgentRecords.eraseMember")),
        eraseUser: (userId) =>
          chats
            .eraseUser(userId)
            .pipe(Effect.withSpan("AgentRecords.eraseUser")),
        eraseWorkspace: (workspaceId) =>
          chats
            .eraseWorkspace(workspaceId)
            .pipe(Effect.withSpan("AgentRecords.eraseWorkspace")),
        exportUser: (userId) =>
          chats
            .exportUser(userId)
            .pipe(Effect.withSpan("AgentRecords.exportUser")),
        purge: DateTime.now.pipe(
          Effect.flatMap((now) =>
            chats.purge(
              DateTime.subtract(now, { days: chatRetentionDays }),
              DateTime.subtract(now, { hours: emptyChatRetentionHours })
            )
          ),
          Effect.withSpan("AgentRecords.purge")
        ),
      });
    })
  );
}
