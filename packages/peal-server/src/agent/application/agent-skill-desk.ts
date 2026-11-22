import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { ownerOf } from "#agent/application/owner-of.ts";
import type { ChatOwner } from "#agent/application/ports/agent-chats.ts";
import { AgentSkills } from "#agent/application/ports/agent-skills.ts";
import { SkillNotFound } from "#agent/application/skill-not-found.ts";
import {
  AgentSkill,
  byName,
  changed,
  editableBy,
  maxSkills,
  nameTaken,
  scopeAllowed,
  skillInstructions,
  skillName,
} from "#agent/domain/agent-skill.ts";
import type {
  SkillChange,
  SkillReader,
  SkillScope,
} from "#agent/domain/agent-skill.ts";
import { AgentSkillIdSchema } from "#agent/domain/ids.ts";
import type { PersonRequired } from "#agent/domain/person-required.ts";
import { SkillRefused } from "#agent/domain/skill-refused.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import { can } from "#shared/domain/access.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";

const decodeSkillId = Schema.decodeUnknownOption(AgentSkillIdSchema);

type Refused = MissingPermission | PersonRequired;

/** A skill the person may use, and whether they may change it. */
export interface UsableSkill {
  readonly editable: boolean;
  readonly skill: AgentSkill;
}

/** A new skill. */
export interface NewSkill {
  readonly instructions: string;
  readonly name: string;
  readonly scope: SkillScope;
}

const readerOf = (actor: Actor, owner: ChatOwner): SkillReader => ({
  configures: can(actor, "assistant:configure"),
  userId: owner.userId,
});

/**
 * The skills of the agent, for a person in their own session with
 * `assistant:use`: their own and the workspace's, which they may use;
 * another person's own reads as none. They change their own personal
 * ones; a workspace skill, which every member's agent is offered, is made,
 * shared, changed and deleted only by those who may manage the
 * workspace's (`assistant:configure`).
 */
export class AgentSkillDesk extends Context.Service<
  AgentSkillDesk,
  {
    /** The skills the person may use, by name whatever its case. */
    readonly skills: (
      actor: Actor
    ) => Effect.Effect<readonly UsableSkill[], Refused>;
    readonly createSkill: (
      actor: Actor,
      skill: NewSkill
    ) => Effect.Effect<UsableSkill, Refused | SkillRefused>;
    readonly updateSkill: (
      actor: Actor,
      skillId: string,
      change: SkillChange
    ) => Effect.Effect<UsableSkill, Refused | SkillNotFound | SkillRefused>;
    readonly deleteSkill: (
      actor: Actor,
      skillId: string
    ) => Effect.Effect<void, Refused | SkillNotFound | SkillRefused>;
  }
>()("peal-server/agent/application/AgentSkillDesk") {
  static readonly layer = Layer.effect(
    AgentSkillDesk,
    Effect.gen(function* AgentSkillDeskLive() {
      const skills = yield* AgentSkills;
      const ids = yield* Ids;

      // The skill, among those the person may use, with them all.
      const found = (owner: ChatOwner, skillId: string) =>
        Effect.gen(function* finding() {
          const usable = yield* skills.usable(owner);

          const skill = Option.flatMap(decodeSkillId(skillId), (id) =>
            Option.fromUndefinedOr(usable.find((one) => one.id === id))
          );

          if (Option.isNone(skill)) {
            return yield* new SkillNotFound({ skillId });
          }

          return { skill: skill.value, usable };
        });

      return AgentSkillDesk.of({
        createSkill: (actor, asked) =>
          Effect.gen(function* createSkill() {
            const owner = yield* ownerOf(actor);
            const reader = readerOf(actor, owner);

            const scope = yield* Effect.fromResult(
              scopeAllowed(asked.scope, reader)
            );

            const usable = yield* skills.usable(owner);
            const name = skillName(asked.name);

            if (usable.length >= maxSkills) {
              return yield* new SkillRefused({ reason: "tooMany" });
            }

            if (nameTaken(usable, name)) {
              return yield* new SkillRefused({ reason: "nameTaken" });
            }

            const now = yield* DateTime.now;

            const skill = new AgentSkill({
              authorId: Option.some(owner.userId),
              createdAt: now,
              id: yield* newId(AgentSkillIdSchema).pipe(
                Effect.provideService(Ids, ids)
              ),
              instructions: skillInstructions(asked.instructions),
              name,
              scope,
              updatedAt: now,
              workspaceId: owner.workspaceId,
            });

            yield* skills.create(skill);

            return { editable: editableBy(skill, reader), skill };
          }).pipe(Effect.withSpan("AgentSkillDesk.createSkill")),
        deleteSkill: (actor, skillId) =>
          Effect.gen(function* deleteSkill() {
            const owner = yield* ownerOf(actor);
            const { skill } = yield* found(owner, skillId);

            if (!editableBy(skill, readerOf(actor, owner))) {
              return yield* new SkillRefused({ reason: "notEditable" });
            }

            const removed = yield* skills.remove(skill.id);

            return yield* removed
              ? Effect.void
              : Effect.fail(new SkillNotFound({ skillId }));
          }).pipe(Effect.withSpan("AgentSkillDesk.deleteSkill")),
        skills: (actor) =>
          Effect.gen(function* listed() {
            const owner = yield* ownerOf(actor);
            const reader = readerOf(actor, owner);
            const usable = yield* skills.usable(owner);

            return usable.toSorted(byName).map((skill): UsableSkill => ({
              editable: editableBy(skill, reader),
              skill,
            }));
          }).pipe(Effect.withSpan("AgentSkillDesk.skills")),
        updateSkill: (actor, skillId, change) =>
          Effect.gen(function* updateSkill() {
            const owner = yield* ownerOf(actor);
            const reader = readerOf(actor, owner);
            const { skill, usable } = yield* found(owner, skillId);

            const next = yield* Effect.fromResult(
              changed(skill, change, reader, yield* DateTime.now)
            );

            if (nameTaken(usable, next.name, Option.some(skill.id))) {
              return yield* new SkillRefused({ reason: "nameTaken" });
            }

            yield* skills.save(next);

            return { editable: editableBy(next, reader), skill: next };
          }).pipe(Effect.withSpan("AgentSkillDesk.updateSkill")),
      });
    })
  );
}
