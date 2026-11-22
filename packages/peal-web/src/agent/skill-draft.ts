import type { Types } from "effect";
import {
  maxAgentSkillInstructionsLength,
  maxAgentSkillNameLength,
} from "peal-contract/agent";
import type {
  AgentSkill,
  AgentSkillRequest,
  AgentSkillScope,
  AgentSkillUpdate,
} from "peal-contract/agent";

// A skill's form as the person fills it in, and the request it sends: the
// name trimmed, as the contract takes it, and only what changed on an
// existing skill.

export interface SkillDraft {
  readonly instructions: string;
  readonly name: string;
  readonly scope: AgentSkillScope;
}

/** A new skill's form: personal until the person shares it. */
export const emptySkillDraft: SkillDraft = {
  instructions: "",
  name: "",
  scope: "personal",
};

/** An existing skill's form, as the server holds it. */
export const draftOf = (skill: AgentSkill): SkillDraft => ({
  instructions: skill.instructions,
  name: skill.name,
  scope: skill.scope,
});

/** What keeps a form from being saved, field by field. */
export interface SkillDraftProblems {
  readonly instructions: "empty" | "tooLong" | null;
  readonly name: "empty" | "tooLong" | null;
}

const lengthProblem = (
  text: string,
  max: number
): "empty" | "tooLong" | null => {
  if (text.trim() === "") {
    return "empty";
  }

  return text.length > max ? "tooLong" : null;
};

/** What is wrong with the form, as the contract would refuse it. */
export const problemsOf = (draft: SkillDraft): SkillDraftProblems => {
  const name = draft.name.trim();

  return {
    instructions: lengthProblem(
      draft.instructions,
      maxAgentSkillInstructionsLength
    ),
    name: lengthProblem(name, maxAgentSkillNameLength),
  };
};

/** Whether the form can be saved: nothing in it the contract refuses. */
export const isSavable = (draft: SkillDraft): boolean => {
  const problems = problemsOf(draft);

  return problems.name === null && problems.instructions === null;
};

/** The request that makes the skill the form describes. */
export const skillRequestOf = (draft: SkillDraft): AgentSkillRequest => ({
  instructions: draft.instructions,
  name: draft.name.trim(),
  scope: draft.scope,
});

/** What the form changes in a skill: each field that differs, alone. */
export const skillUpdateOf = (
  skill: AgentSkill,
  draft: SkillDraft
): AgentSkillUpdate => {
  const name = draft.name.trim();
  const update: Types.Mutable<AgentSkillUpdate> = {};

  if (draft.instructions !== skill.instructions) {
    update.instructions = draft.instructions;
  }

  if (name !== skill.name) {
    update.name = name;
  }

  if (draft.scope !== skill.scope) {
    update.scope = draft.scope;
  }

  return update;
};
