import { describe, expect, it } from "@effect/vitest";
import { DateTime, Exit } from "effect";
import { Forbidden } from "peal-contract";
import {
  AgentSkillNotFound,
  AgentSkillRefused,
  maxAgentSkillNameLength,
} from "peal-contract/agent";
import type { AgentSkill } from "peal-contract/agent";

import {
  draftOf,
  emptySkillDraft,
  isSavable,
  problemsOf,
  skillRequestOf,
  skillUpdateOf,
} from "#agent/skill-draft.ts";
import { skillProblemOf } from "#agent/skill-refusal.ts";

const at = DateTime.makeUnsafe("2026-11-22T08:51:00Z");

const skill: AgentSkill = {
  createdAt: at,
  editable: true,
  id: "skill-1",
  instructions: "Look at next week, then draft for the empty days.",
  name: "Plan next week",
  scope: "personal",
  updatedAt: at,
};

describe(problemsOf, () => {
  it("asks for a name and instructions", () => {
    expect(problemsOf(emptySkillDraft)).toStrictEqual({
      instructions: "empty",
      name: "empty",
    });
    expect(isSavable(emptySkillDraft)).toBeFalsy();
    expect(
      problemsOf({ ...emptySkillDraft, instructions: "  ", name: "  " })
    ).toStrictEqual({ instructions: "empty", name: "empty" });
  });

  it("refuses a name longer than the contract takes, once trimmed", () => {
    const name = "a".repeat(maxAgentSkillNameLength);

    expect(
      problemsOf({ ...draftOf(skill), name: ` ${name} ` }).name
    ).toBeNull();
    expect(problemsOf({ ...draftOf(skill), name: `${name}a` }).name).toBe(
      "tooLong"
    );
  });

  it("lets a filled form be saved", () => {
    expect(isSavable(draftOf(skill))).toBeTruthy();
  });
});

describe(skillRequestOf, () => {
  it("sends the name trimmed and the instructions as written", () => {
    expect(
      skillRequestOf({
        instructions: " Keep it short. ",
        name: "  Short replies ",
        scope: "workspace",
      })
    ).toStrictEqual({
      instructions: " Keep it short. ",
      name: "Short replies",
      scope: "workspace",
    });
  });
});

describe(skillUpdateOf, () => {
  it("sends only what changed", () => {
    expect(skillUpdateOf(skill, draftOf(skill))).toStrictEqual({});
    expect(
      skillUpdateOf(skill, { ...draftOf(skill), name: " Plan next week " })
    ).toStrictEqual({});
    expect(
      skillUpdateOf(skill, {
        ...draftOf(skill),
        name: "Plan the week",
        scope: "workspace",
      })
    ).toStrictEqual({ name: "Plan the week", scope: "workspace" });
  });
});

describe(skillProblemOf, () => {
  it("reads the contract's refusals", () => {
    expect(skillProblemOf(Exit.succeed(skill))).toBeNull();
    expect(
      skillProblemOf(Exit.fail(new AgentSkillRefused({ reason: "nameTaken" })))
    ).toBe("nameTaken");
    expect(
      skillProblemOf(Exit.fail(new AgentSkillRefused({ reason: "tooMany" })))
    ).toBe("tooMany");
    expect(
      skillProblemOf(
        Exit.fail(new AgentSkillRefused({ reason: "notEditable" }))
      )
    ).toBe("notEditable");
  });

  it("reads a skill that is gone, a role refused, and anything else", () => {
    expect(
      skillProblemOf(Exit.fail(new AgentSkillNotFound({ skillId: "gone" })))
    ).toBe("notFound");
    expect(skillProblemOf(Exit.fail(new Forbidden({})))).toBe("forbidden");
    expect(skillProblemOf(Exit.fail({ _tag: "Offline" }))).toBe("unexpected");
    expect(skillProblemOf(Exit.die("boom"))).toBe("unexpected");
  });
});
