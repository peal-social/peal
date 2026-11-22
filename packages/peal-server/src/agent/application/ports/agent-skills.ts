import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { ChatOwner } from "#agent/application/ports/agent-chats.ts";
import type { AgentSkill } from "#agent/domain/agent-skill.ts";
import type { AgentSkillId } from "#agent/domain/ids.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/**
 * The skills, in the agent's schema. Reads name the person: they find
 * their own and the workspace's, never another person's own. A database
 * failure is a defect, but where another context waits on it (erasures,
 * the export).
 */
export class AgentSkills extends Context.Service<
  AgentSkills,
  {
    /** The skills the person may use in the workspace, in no order. */
    readonly usable: (owner: ChatOwner) => Effect.Effect<readonly AgentSkill[]>;
    /** One skill the person may use; none for any other. */
    readonly skill: (
      owner: ChatOwner,
      skillId: AgentSkillId
    ) => Effect.Effect<Option.Option<AgentSkill>>;
    readonly create: (skill: AgentSkill) => Effect.Effect<void>;
    /** Keeps the skill as it now stands. */
    readonly save: (skill: AgentSkill) => Effect.Effect<void>;
    /** Deletes it; false when there was none. */
    readonly remove: (skillId: AgentSkillId) => Effect.Effect<boolean>;
    readonly eraseWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * Deletes the person's own skills in every workspace, and leaves the
     * workspace skills they wrote to their workspaces, with no author.
     */
    readonly eraseUser: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    /** As `eraseUser`, in one workspace: the person left it. */
    readonly eraseMember: (
      owner: ChatOwner
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * The person's skills in every workspace: their own, and the
     * workspace skills they wrote, the oldest first.
     */
    readonly exportUser: (
      userId: UserId
    ) => Effect.Effect<readonly AgentSkill[], DatabaseError>;
  }
>()("peal-server/agent/application/AgentSkills") {}
