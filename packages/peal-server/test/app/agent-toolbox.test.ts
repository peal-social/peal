import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Option, Schema } from "effect";
import { LanguageModel, Tool } from "effect/ai";
import { toCodecAnthropic } from "effect/ai/AnthropicStructuredOutput";
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput";

import { shownParametersOf } from "#agent/domain/agent-approvals.ts";
import {
  agentToolNames,
  approvedTools,
  draftFreeTools,
  freeTools,
} from "#agent/domain/agent-toolset.ts";
import { siblingConflicts } from "#agent/infrastructure/advertised-schema.ts";
import { agentToolkit } from "#app/agent/toolbox.ts";
import { changingTools } from "#app/mcp/server.ts";
import { PealTools } from "#app/mcp/tools.ts";

const { tools } = agentToolkit(() => Effect.succeed(false));

const decodeJson = Schema.decodeUnknownSync(Schema.Json);

// What each adapter would send for a tool's parameters: the Anthropic and
// OpenAI-compatible adapters read the same function, with the strict or
// the default transformer.
const transformers = {
  anthropicStrict: toCodecAnthropic,
  default: LanguageModel.defaultCodecTransformer,
  openAiStrict: toCodecOpenAI,
};

describe("the agent's toolkit", () => {
  it("holds the MCP endpoint's tools it names, by the same names and schemas", () => {
    expect(Object.keys(tools).toSorted()).toStrictEqual(
      [...agentToolNames].toSorted()
    );

    for (const name of agentToolNames) {
      const mcp = PealTools.tools[name];

      expect(tools[name]?.description).toBe(mcp.description);
      expect(tools[name]?.failureMode).toBe("return");
    }
  });

  it("runs what reads or writes a draft, and asks before anything else that changes", () => {
    for (const name of freeTools) {
      expect(tools[name]?.needsApproval).toBeUndefined();
    }

    for (const name of approvedTools) {
      expect(tools[name]?.needsApproval).toBeTruthy();
    }

    for (const name of draftFreeTools) {
      expect(tools[name]?.needsApproval).toBeTypeOf("function");
    }

    // Every tool that changes something outside a draft asks first.
    const changingFree = freeTools.filter(
      (name) =>
        changingTools.has(name) &&
        !["create_draft", "update_draft", "duplicate_post"].includes(name)
    );

    expect(changingFree).toStrictEqual([]);
  });

  it("advertises no schema whose allOf member sets a key its object sets, for any adapter", () => {
    for (const name of agentToolNames) {
      const tool = tools[name];

      expect(tool).toBeDefined();

      if (tool === undefined) {
        continue;
      }

      // Not strict: no adapter rewrites the schema into its strict subset.
      expect(Context.get(tool.annotations, Tool.Strict)).toBeFalsy();

      for (const transformer of Object.values(transformers)) {
        const sent = decodeJson(Tool.getJsonSchema(tool, { transformer }));

        expect(siblingConflicts(sent)).toStrictEqual([]);
      }
    }

    // The MCP tools' own schemas hold such a conflict, which Anthropic
    // refuses: an id's UUID pattern beside its lowercase one.
    expect(
      siblingConflicts(
        decodeJson(
          Tool.getJsonSchemaFromSchema(
            PealTools.tools.create_draft.parametersSchema
          )
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it("shows on a change's card every parameter its MCP tool takes, and no more", () => {
    const keysOf = Schema.decodeUnknownSync(
      Schema.Struct({
        properties: Schema.Record(Schema.String, Schema.Json),
      })
    );

    for (const name of [...approvedTools, ...draftFreeTools]) {
      const taken = Object.keys(
        keysOf(
          Tool.getJsonSchemaFromSchema(PealTools.tools[name].parametersSchema)
        ).properties
      ).toSorted();

      expect([name, taken]).toStrictEqual([
        name,
        [...Option.getOrElse(shownParametersOf(name), () => [])].toSorted(),
      ]);
    }
  });

  it("offers no webhook, key, member, connection, ad, feed or message tool", () => {
    const refused = [
      "create_webhook",
      "invite_member",
      "boost_post",
      "create_feed",
      "start_comment_rule",
      "send_message",
      "get_conversation",
      "generate_image",
      // Its post takes channel sets, signatures and default options only
      // the server resolves: the agent drafts, then schedules the draft.
      "create_post",
    ];

    for (const name of refused) {
      expect(agentToolNames).not.toContain(name);
    }

    expect(Object.values(tools).every(Tool.isDynamic)).toBeTruthy();
  });
});
