import { maxAgentMessageSkills } from "peal-contract/agent";
import type { AgentMessageSkill, AgentSkill } from "peal-contract/agent";

// How the composer picks skills: the "/" menu, which lists the person's
// skills by what follows the "/", and the chips a message sends with it.
// The "/" itself is found in the text by ui-sdk's trigger menu; what it
// lists, and when it stays open, is decided here, so it is tested apart
// from the page.

/**
 * The skills a message may still pick: none once it holds the most a
 * message takes, and never one it holds already.
 */
export const offeredSkills = (
  skills: readonly AgentSkill[],
  picked: readonly AgentMessageSkill[]
): readonly AgentSkill[] =>
  picked.length >= maxAgentMessageSkills
    ? []
    : skills.filter(({ id }) => !picked.some((each) => each.id === id));

/** The skills whose name holds the query, whatever its case. */
export const matchingSkills = (
  skills: readonly AgentSkill[],
  query: string
): readonly AgentSkill[] => {
  const wanted = query.toLocaleLowerCase();

  return skills.filter(({ name }) => name.toLocaleLowerCase().includes(wanted));
};

/**
 * What the "/" menu lists for what follows the "/" (then "Create
 * skill…"), or null when it stays closed: a query with a space in it
 * keeps it open only while a skill's name holds it, so a sentence that
 * starts with "/" goes on as text, and Enter sends it.
 */
export const slashSkillsOf = (
  query: string,
  offered: readonly AgentSkill[]
): readonly AgentSkill[] | null => {
  const listed = matchingSkills(offered, query);

  return listed.length === 0 && /\s/u.test(query) ? null : listed;
};

/** The skills picked once this one joins them, never twice, three at most. */
export const pickSkill = (
  picked: readonly AgentMessageSkill[],
  skill: AgentMessageSkill
): readonly AgentMessageSkill[] =>
  picked.some(({ id }) => id === skill.id) ||
  picked.length >= maxAgentMessageSkills
    ? picked
    : [...picked, { id: skill.id, name: skill.name }];

/**
 * The text a message sends: what was written, or, with only skills
 * picked, their names, as a message needs text.
 */
export const sentTextOf = (
  text: string,
  picked: readonly AgentMessageSkill[]
): string => {
  const written = text.trim();

  return written === "" ? picked.map(({ name }) => name).join(", ") : written;
};
