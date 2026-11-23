import { Option, Result, Schema } from "effect";
import type { DateTime } from "effect";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";
import { storableLine, storableText } from "#shared/domain/platform-text.ts";

import { AgentSkillIdSchema } from "./ids.ts";
import type { AgentSkillId } from "./ids.ts";
import { SkillRefused } from "./skill-refused.ts";

// A skill is instructions a person saves for a task they repeat: they
// pick it in a message, or the agent reads it when a request fits it.

/** The longest name a skill takes, as the contract takes it. */
export const maxSkillNameLength = 60;

/** The longest instructions a skill takes, as the contract takes it. */
export const maxSkillInstructionsLength = 8000;

/** The most skills a message picks, as the contract takes it. */
export const maxPickedSkills = 3;

/**
 * The most skills a person sees in a workspace, theirs and the
 * workspace's: they make no more past it, and the model is told of as
 * many beside a message.
 */
export const maxSkills = 100;

/** Whose a skill is: its author's alone, or every member's who may use the agent. */
export const SkillScopeSchema = Schema.Literals(["personal", "workspace"]);

export type SkillScope = typeof SkillScopeSchema.Type;

/**
 * A skill: a name and instructions. A personal one is its author's alone,
 * and goes with them; a workspace one stays with the workspace when its
 * author leaves it or closes their account (`authorId` none then).
 */
export class AgentSkill extends Schema.Class<AgentSkill>(
  "peal-server/agent/domain/AgentSkill"
)({
  authorId: Schema.Option(UserIdSchema),
  createdAt: Schema.DateTimeUtc,
  id: AgentSkillIdSchema,
  instructions: Schema.String,
  name: Schema.String,
  scope: SkillScopeSchema,
  updatedAt: Schema.DateTimeUtc,
  workspaceId: WorkspaceIdSchema,
}) {}

/**
 * Who reads or changes skills: a person, and whether they may manage the
 * workspace's (`assistant:configure`).
 */
export interface SkillReader {
  readonly configures: boolean;
  readonly userId: UserId;
}

/** What changes in a skill. */
export interface SkillChange {
  readonly instructions?: string;
  readonly name?: string;
  readonly scope?: SkillScope;
}

const isAuthor = (skill: AgentSkill, userId: UserId) =>
  Option.exists(skill.authorId, (author) => author === userId);

/** Whether the person may use it: their own, or the workspace's. */
export const usableBy = (skill: AgentSkill, userId: UserId): boolean =>
  skill.scope === "workspace" || isAuthor(skill, userId);

/**
 * Whether the person may change or delete it: their own personal one, or
 * a workspace skill when they may manage the workspace's. A workspace
 * skill's author alone may not: what every member's agent is offered is
 * the managers' to change.
 */
export const editableBy = (skill: AgentSkill, reader: SkillReader): boolean =>
  skill.scope === "workspace"
    ? reader.configures
    : isAuthor(skill, reader.userId);

/**
 * The scope a new skill takes, as the person may give it: a workspace
 * skill, which every member's agent is offered, needs
 * `assistant:configure`.
 */
export const scopeAllowed = (
  scope: SkillScope,
  reader: SkillReader
): Result.Result<SkillScope, MissingPermission> =>
  scope === "workspace" && !reader.configures
    ? Result.fail(new MissingPermission({ permission: "assistant:configure" }))
    : Result.succeed(scope);

/** A skill's name as it is kept: one line, bounded. */
export const skillName = (name: string): string =>
  storableLine(name, maxSkillNameLength);

/** A skill's instructions as they are kept, bounded. */
export const skillInstructions = (instructions: string): string =>
  storableText(instructions, maxSkillInstructionsLength);

const caseless = new Intl.Collator("en", { sensitivity: "accent" });

/** Whether two names read as one, whatever their case. */
export const sameName = (one: string, other: string): boolean =>
  caseless.compare(one, other) === 0;

/** The order skills are listed in: by name, whatever its case, then made first. */
export const byName = (one: AgentSkill, other: AgentSkill): number => {
  const named = caseless.compare(one.name, other.name);

  if (named !== 0) {
    return named;
  }

  if (one.id === other.id) {
    return 0;
  }

  return one.id < other.id ? -1 : 1;
};

/**
 * Whether another skill the person may use than `except` has this name:
 * picking one by name would be ambiguous.
 */
export const nameTaken = (
  usable: readonly AgentSkill[],
  name: string,
  except: Option.Option<AgentSkillId> = Option.none()
): boolean =>
  usable.some(
    (skill) =>
      sameName(skill.name, name) &&
      !Option.exists(except, (id) => id === skill.id)
  );

/**
 * The skill as the person changes it at `now`: refused when they may not
 * change it, when they move their own to the workspace without
 * `assistant:configure`, and when they move a workspace skill back to
 * personal that is not theirs (only its author may, while they manage the
 * workspace's; it is theirs then).
 */
export const changed = (
  skill: AgentSkill,
  change: SkillChange,
  reader: SkillReader,
  now: DateTime.Utc
): Result.Result<AgentSkill, MissingPermission | SkillRefused> => {
  const toPersonal = change.scope === "personal" && skill.scope === "workspace";

  if (
    !editableBy(skill, reader) ||
    (toPersonal && !isAuthor(skill, reader.userId))
  ) {
    return Result.fail(new SkillRefused({ reason: "notEditable" }));
  }

  if (change.scope === "workspace" && skill.scope === "personal") {
    const allowed = scopeAllowed(change.scope, reader);

    if (Result.isFailure(allowed)) {
      return Result.fail(allowed.failure);
    }
  }

  return Result.succeed(
    new AgentSkill({
      authorId: skill.authorId,
      createdAt: skill.createdAt,
      id: skill.id,
      instructions:
        change.instructions === undefined
          ? skill.instructions
          : skillInstructions(change.instructions),
      name: change.name === undefined ? skill.name : skillName(change.name),
      scope: change.scope ?? skill.scope,
      updatedAt: now,
      workspaceId: skill.workspaceId,
    })
  );
};
