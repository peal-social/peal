import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { AgentSkill } from "peal-contract/agent";

import {
  matchingSkills,
  offeredSkills,
  pickSkill,
  sentTextOf,
  slashSkillsOf,
  writtenTextOf,
} from "#agent/skill-picker.ts";

const at = DateTime.makeUnsafe("2026-11-22T08:51:00Z");

const skill = (id: string, name: string): AgentSkill => ({
  createdAt: at,
  editable: true,
  id,
  instructions: "Synthetic instructions.",
  name,
  scope: "personal",
  updatedAt: at,
});

const plan = skill("s1", "Plan next week");
const review = skill("s2", "Answer a review");
const report = skill("s3", "Monthly report");
const skills = [plan, review, report];

describe(matchingSkills, () => {
  it("keeps the skills whose name holds the query, whatever its case", () => {
    expect(matchingSkills(skills, "RE")).toStrictEqual([review, report]);
    expect(matchingSkills(skills, "")).toStrictEqual(skills);
    expect(matchingSkills(skills, "xyz")).toStrictEqual([]);
  });
});

describe(offeredSkills, () => {
  it("leaves out the skills already picked", () => {
    expect(offeredSkills(skills, [{ id: "s1", name: "Plan" }])).toStrictEqual([
      review,
      report,
    ]);
  });

  it("offers none once three are picked", () => {
    expect(
      offeredSkills(
        [...skills, skill("s4", "Fourth")],
        [
          { id: "s1", name: "a" },
          { id: "s2", name: "b" },
          { id: "s3", name: "c" },
        ]
      )
    ).toStrictEqual([]);
  });
});

describe(slashSkillsOf, () => {
  it("lists the skills that match what follows the slash", () => {
    expect(slashSkillsOf("rev", skills)).toStrictEqual([review]);
    expect(slashSkillsOf("", skills)).toStrictEqual(skills);
  });

  it("stays open with no match while the query is one word, for Create skill", () => {
    expect(slashSkillsOf("xyz", skills)).toStrictEqual([]);
  });

  it("follows a name with spaces, and closes on a sentence no name holds", () => {
    expect(slashSkillsOf("plan next", skills)).toStrictEqual([plan]);
    expect(slashSkillsOf("etc and more", skills)).toBeNull();
  });
});

describe(pickSkill, () => {
  it("adds a skill once, three at most", () => {
    const one = pickSkill([], plan);

    expect(one).toStrictEqual([{ id: "s1", name: "Plan next week" }]);
    expect(pickSkill(one, plan)).toBe(one);

    const three = pickSkill(pickSkill(one, review), report);

    expect(three).toHaveLength(3);
    expect(pickSkill(three, skill("s4", "Fourth"))).toBe(three);
  });
});

describe(sentTextOf, () => {
  it("sends the text written, trimmed", () => {
    expect(sentTextOf("  Plan it ", [{ id: "s1", name: "Plan" }])).toBe(
      "Plan it"
    );
  });

  it("sends the skills' names when nothing is written", () => {
    expect(
      sentTextOf(" ", [
        { id: "s1", name: "Plan next week" },
        { id: "s3", name: "Monthly report" },
      ])
    ).toBe("Plan next week, Monthly report");
  });
});

describe(writtenTextOf, () => {
  const sentWith = [
    { id: "s1", name: "Plan next week" },
    { id: "s3", name: "Monthly report" },
  ];

  it("shows no text when the message is only its skills' names", () => {
    expect(
      writtenTextOf({
        skills: sentWith,
        text: "Plan next week, Monthly report",
      })
    ).toBeNull();
  });

  it("shows what the person wrote, even when it is a skill's name", () => {
    expect(writtenTextOf({ skills: sentWith, text: "Plan next week" })).toBe(
      "Plan next week"
    );
    expect(writtenTextOf({ skills: [], text: "" })).toBe("");
  });
});
