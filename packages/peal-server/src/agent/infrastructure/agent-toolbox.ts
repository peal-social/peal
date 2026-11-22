import { Context } from "effect";
import type { Effect, Schema } from "effect";
import type { Tool, Toolkit } from "effect/ai";
import type { CurrentMember, Member } from "peal-contract";

import type { RequestOrigin } from "#agent/application/ports/agent-runs.ts";

/** A call of a tool that ran, as the records keep it: never what it carried. */
export interface ToolCallRecord {
  readonly member: Member;
  readonly origin: RequestOrigin;
  /** The tool answered a refusal (`ToolRefused`) or failed. */
  readonly refused: boolean;
  readonly tool: string;
}

/**
 * One of the agent's tools: an MCP endpoint's tool, its refusals returned
 * to the model, acting as the CurrentMember.
 */
export type AgentTool = Tool.Tool<
  string,
  {
    readonly failure: ServicelessSchema;
    readonly failureMode: "return";
    readonly parameters: ServicelessSchema;
    readonly success: ServicelessSchema;
  },
  CurrentMember
>;

/** A schema that needs no service to decode or encode, as the tools' are. */
export interface ServicelessSchema extends Schema.Top {
  readonly DecodingServices: never;
  readonly EncodingServices: never;
}

/**
 * The agent's tools: those of Peal's MCP endpoint it may call
 * (`agent-toolset.ts`), with their own handlers, each refusal returned to
 * the model rather than ending the run, and an approval asked before each
 * call that others see, that cannot be undone or that costs money. The
 * handlers act as the CurrentMember provided around each call. `record`
 * keeps a call that changes something as the MCP endpoint's are kept: the
 * workspace's activity log, and the connection that changed content.
 */
export class AgentToolbox extends Context.Service<
  AgentToolbox,
  {
    readonly toolkit: Toolkit.WithHandler<Record<string, AgentTool>>;
    /** Whether a tool changes something, as the MCP endpoint annotates it. */
    readonly changes: (tool: string) => boolean;
    readonly record: (call: ToolCallRecord) => Effect.Effect<void>;
  }
>()("peal-server/agent/infrastructure/AgentToolbox") {}
