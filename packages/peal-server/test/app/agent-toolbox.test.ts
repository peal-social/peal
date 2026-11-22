import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { Tool } from "effect/ai";

import {
  agentToolNames,
  approvedTools,
  draftFreeTools,
  freeTools,
} from "#agent/domain/agent-toolset.ts";
import { agentToolkit } from "#app/agent/toolbox.ts";
import { changingTools } from "#app/mcp/server.ts";
import { PealTools } from "#app/mcp/tools.ts";

const { tools } = agentToolkit(() => Effect.succeed(false));

describe("the agent's toolkit", () => {
  it("holds the MCP endpoint's tools it names, by the same names and schemas", () => {
    expect(Object.keys(tools).toSorted()).toStrictEqual(
      [...agentToolNames].toSorted()
    );

    for (const name of agentToolNames) {
      const mcp = PealTools.tools[name];

      expect(tools[name]?.parametersSchema).toBe(mcp.parametersSchema);
      expect(tools[name]?.id).toBe(mcp.id);
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
    ];

    for (const name of refused) {
      expect(agentToolNames).not.toContain(name);
    }

    expect(Object.values(tools).every(Tool.isUserDefined)).toBeTruthy();
  });
});
