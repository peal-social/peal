import { Context, DateTime, Effect, Layer } from "effect";

import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import type { ExportedChat } from "#agent/application/ports/agent-chats.ts";
import { AgentSkills } from "#agent/application/ports/agent-skills.ts";
import {
  chatRetentionDays,
  emptyChatRetentionHours,
} from "#agent/domain/run-limits.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { AgentSkillRecord } from "#shared/application/personal-data.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/**
 * What the agent keeps about people, for the workspace context: a
 * person's chats and skills in their export, and their erasure with a
 * workspace, a membership that ends, or an account that closes (their
 * own skills go, the workspace skills they wrote stay with the workspace,
 * without them); and the retention, which deletes a chat
 * `chatRetentionDays` after its last message. Erasures run in the
 * caller's transaction.
 */
export class AgentRecords extends Context.Service<
  AgentRecords,
  {
    readonly exportUser: (
      userId: UserId
    ) => Effect.Effect<readonly ExportedChat[], DatabaseError>;
    /** Their own skills and the workspace skills they wrote, everywhere. */
    readonly exportSkills: (
      userId: UserId
    ) => Effect.Effect<readonly AgentSkillRecord[], DatabaseError>;
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
      const skills = yield* AgentSkills;

      return AgentRecords.of({
        eraseMember: (workspaceId, userId) =>
          chats
            .eraseMember({ userId, workspaceId })
            .pipe(
              Effect.andThen(skills.eraseMember({ userId, workspaceId })),
              Effect.withSpan("AgentRecords.eraseMember")
            ),
        eraseUser: (userId) =>
          chats
            .eraseUser(userId)
            .pipe(
              Effect.andThen(skills.eraseUser(userId)),
              Effect.withSpan("AgentRecords.eraseUser")
            ),
        eraseWorkspace: (workspaceId) =>
          chats
            .eraseWorkspace(workspaceId)
            .pipe(
              Effect.andThen(skills.eraseWorkspace(workspaceId)),
              Effect.withSpan("AgentRecords.eraseWorkspace")
            ),
        exportSkills: (userId) =>
          skills.exportUser(userId).pipe(
            Effect.map((exported) =>
              exported.map((skill): AgentSkillRecord => ({
                createdAt: skill.createdAt,
                id: skill.id,
                instructions: skill.instructions,
                name: skill.name,
                scope: skill.scope,
                updatedAt: skill.updatedAt,
                workspaceId: skill.workspaceId,
              }))
            ),
            Effect.withSpan("AgentRecords.exportSkills")
          ),
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
