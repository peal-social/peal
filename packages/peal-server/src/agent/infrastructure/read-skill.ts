import { Effect, Option, Schema } from "effect";
import type { SchemaAST } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { CurrentMember } from "peal-contract";

import type { ChatOwner } from "#agent/application/ports/agent-chats.ts";
import type { AgentSkills } from "#agent/application/ports/agent-skills.ts";
import type { AgentSkill } from "#agent/domain/agent-skill.ts";
import { AgentSkillIdSchema } from "#agent/domain/ids.ts";
import type {
  AgentTool,
  AgentToolbox,
} from "#agent/infrastructure/agent-toolbox.ts";
import { SkillUnreadable } from "#agent/infrastructure/skill-unreadable.ts";

/** The agent's own tool that reads a skill: never one of the MCP endpoint's. */
export const readSkillName = "read_skill";

const decodeSkillId = Schema.decodeUnknownOption(AgentSkillIdSchema);

const unreadable = new SkillUnreadable({
  message:
    "The person may use no skill with this id: use only the ids given beside their message.",
});

const ReadSkillParamsSchema = Schema.Struct({ skillId: Schema.String });

const decodeParams = Schema.decodeUnknownOption(ReadSkillParamsSchema);

// It runs as the model calls it, as reads do, and answers the skill's
// name and instructions.
const readSkillTool: AgentTool = Tool.make(readSkillName, {
  dependencies: [CurrentMember],
  description:
    "Read one of the skills the person may use, by the id given beside their message: its name and its instructions, which you then follow for their request.",
  failure: SkillUnreadable,
  failureMode: "return",
  parameters: ReadSkillParamsSchema,
  success: Schema.Struct({
    instructions: Schema.String,
    name: Schema.String,
  }),
}).annotate(Tool.Strict, false);

const ReadSkillToolkit = Toolkit.make(readSkillTool);

type AgentToolkit = AgentToolbox["Service"]["toolkit"];

/**
 * The run's toolkit: the toolbox's tools, and `read_skill`, which reads
 * a skill the owner may use, now: another person's own, another
 * workspace's or a deleted one is refused to the model.
 */
export const withReadSkill = (
  toolkit: AgentToolkit,
  skills: AgentSkills["Service"],
  owner: ChatOwner
): Effect.Effect<AgentToolkit> => {
  // The parameters as the tool's schema decoded them, read once more as
  // the handler is typed for any of the agent's tools.
  const read = (params: Tool.Parameters<AgentTool>) =>
    Option.match(
      decodeParams(params).pipe(
        Option.flatMap(({ skillId }) => decodeSkillId(skillId))
      ),
      {
        onNone: () => Effect.succeed(Option.none<AgentSkill>()),
        onSome: (id) => skills.skill(owner, id),
      }
    ).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(unreadable),
          onSome: ({ instructions, name }) =>
            Effect.succeed({ instructions, name }),
        })
      )
    );

  return ReadSkillToolkit.pipe(
    Effect.provide(
      ReadSkillToolkit.toLayer(Object.fromEntries([[readSkillName, read]]))
    ),
    Effect.map((own): AgentToolkit => ({
      handle: (
        name: string,
        params: Parameters<AgentToolkit["handle"]>[1],
        toolCallId?: string,
        options?: SchemaAST.ParseOptions
      ) =>
        name === readSkillName
          ? own.handle(name, params, toolCallId, options)
          : toolkit.handle(name, params, toolCallId, options),
      tools: { ...toolkit.tools, ...own.tools },
    }))
  );
};
