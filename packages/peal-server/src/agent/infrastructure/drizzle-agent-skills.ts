import { and, asc, eq, or } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";

import type { ChatOwner } from "#agent/application/ports/agent-chats.ts";
import { AgentSkills } from "#agent/application/ports/agent-skills.ts";
import { AgentSkill } from "#agent/domain/agent-skill.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { skills } from "./schema.ts";

type SkillRow = typeof skills.$inferSelect;

const failed = (cause: unknown) => new DatabaseError({ cause });

const date = (instant: DateTime.Utc) => DateTime.toDateUtc(instant);

const decodeSkill = Schema.decodeUnknownEffect(AgentSkill);

// Rows are decoded with the domain's schema, so one the domain could not
// have written fails loudly instead of being trusted.
const skillOf = (row: SkillRow) =>
  decodeSkill({
    authorId: Option.fromNullOr(row.authorId),
    createdAt: DateTime.fromDateUnsafe(row.createdAt),
    id: row.id,
    instructions: row.instructions,
    name: row.name,
    scope: row.scope,
    updatedAt: DateTime.fromDateUnsafe(row.updatedAt),
    workspaceId: row.workspaceId,
  }).pipe(Effect.orDie);

const columnsOf = (skill: AgentSkill) => ({
  authorId: Option.getOrNull(skill.authorId),
  createdAt: date(skill.createdAt),
  id: skill.id,
  instructions: skill.instructions,
  name: skill.name,
  scope: skill.scope,
  updatedAt: date(skill.updatedAt),
  workspaceId: skill.workspaceId,
});

// The skills the person may use there: their own and the workspace's.
const usableBy = ({ userId, workspaceId }: ChatOwner) =>
  and(
    eq(skills.workspaceId, workspaceId),
    or(
      eq(skills.scope, "workspace"),
      and(eq(skills.scope, "personal"), eq(skills.authorId, userId))
    )
  );

const theirOwn = (userId: UserId) =>
  and(eq(skills.scope, "personal"), eq(skills.authorId, userId));

const theyWrote = (userId: UserId) =>
  and(eq(skills.scope, "workspace"), eq(skills.authorId, userId));

/**
 * AgentSkills in the agent's schema, one row a skill. A person leaving
 * takes their own skills with them, and leaves the workspace's they wrote
 * without an author.
 */
export const DrizzleAgentSkillsLive = Layer.effect(
  AgentSkills,
  Effect.gen(function* DrizzleAgentSkills() {
    const db = yield* Drizzle;

    return AgentSkills.of({
      create: (skill) =>
        db
          .insert(skills)
          .values(columnsOf(skill))
          .pipe(
            Effect.orDie,
            Effect.asVoid,
            Effect.withSpan("AgentSkills.create")
          ),
      eraseMember: (owner) =>
        Effect.gen(function* eraseMember() {
          yield* db
            .delete(skills)
            .where(
              and(
                eq(skills.workspaceId, owner.workspaceId),
                theirOwn(owner.userId)
              )
            );
          yield* db
            .update(skills)
            .set({ authorId: null })
            .where(
              and(
                eq(skills.workspaceId, owner.workspaceId),
                theyWrote(owner.userId)
              )
            );
        }).pipe(
          Effect.mapError(failed),
          Effect.withSpan("AgentSkills.eraseMember")
        ),
      eraseUser: (userId) =>
        Effect.gen(function* eraseUser() {
          yield* db.delete(skills).where(theirOwn(userId));
          yield* db
            .update(skills)
            .set({ authorId: null })
            .where(theyWrote(userId));
        }).pipe(
          Effect.mapError(failed),
          Effect.withSpan("AgentSkills.eraseUser")
        ),
      eraseWorkspace: (workspaceId) =>
        db
          .delete(skills)
          .where(eq(skills.workspaceId, workspaceId))
          .pipe(
            Effect.mapError(failed),
            Effect.asVoid,
            Effect.withSpan("AgentSkills.eraseWorkspace")
          ),
      exportUser: (userId) =>
        db
          .select()
          .from(skills)
          .where(eq(skills.authorId, userId))
          .orderBy(asc(skills.createdAt), asc(skills.id))
          .pipe(
            Effect.mapError(failed),
            Effect.flatMap(Effect.forEach(skillOf)),
            Effect.map((rows): readonly AgentSkill[] => rows),
            Effect.withSpan("AgentSkills.exportUser")
          ),
      skill: (owner, skillId) =>
        db
          .select()
          .from(skills)
          .where(and(usableBy(owner), eq(skills.id, skillId)))
          .pipe(
            Effect.orDie,
            Effect.flatMap((rows) =>
              rows[0] === undefined
                ? Effect.succeedNone
                : skillOf(rows[0]).pipe(Effect.map(Option.some))
            ),
            Effect.withSpan("AgentSkills.skill")
          ),
      remove: (skillId) =>
        db
          .delete(skills)
          .where(eq(skills.id, skillId))
          .returning({ id: skills.id })
          .pipe(
            Effect.orDie,
            Effect.map((rows) => rows.length > 0),
            Effect.withSpan("AgentSkills.remove")
          ),
      save: (skill) =>
        db
          .update(skills)
          .set({
            instructions: skill.instructions,
            name: skill.name,
            scope: skill.scope,
            updatedAt: date(skill.updatedAt),
          })
          .where(eq(skills.id, skill.id))
          .pipe(
            Effect.orDie,
            Effect.asVoid,
            Effect.withSpan("AgentSkills.save")
          ),
      usable: (owner) =>
        db
          .select()
          .from(skills)
          .where(usableBy(owner))
          .pipe(
            Effect.orDie,
            Effect.flatMap(Effect.forEach(skillOf)),
            Effect.map((rows): readonly AgentSkill[] => rows),
            Effect.withSpan("AgentSkills.usable")
          ),
    });
  })
);
