import { Schema } from "effect";

/** Neither the workspace nor the server has a language model for the agent: it is off. */
export class AgentModelOff extends Schema.TaggedError<AgentModelOff>()(
  "AgentModelOff",
  {}
) {}
