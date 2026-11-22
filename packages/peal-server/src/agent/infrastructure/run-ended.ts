import { Schema } from "effect";

import { AgentFailureSchema } from "#agent/domain/agent-parts.ts";

/** A run that ended before its answer, and why, by kind only. */
export class RunEnded extends Schema.TaggedError<RunEnded>()("RunEnded", {
  reason: AgentFailureSchema,
}) {}
