import type {
  AgentApproval,
  AgentCard,
  AgentFailure,
  AgentOutcome,
  AgentStep,
} from "./agent-parts.ts";

/** What a run sends as it goes, as the contract's `AgentEvent` tells it. */
export type AgentEvent =
  | {
      readonly _tag: "started";
      readonly messageId: string;
      readonly userMessageId: string | null;
    }
  | { readonly _tag: "text"; readonly delta: string }
  | { readonly _tag: "step"; readonly step: AgentStep }
  | { readonly _tag: "card"; readonly card: AgentCard }
  | { readonly _tag: "approval"; readonly approval: AgentApproval }
  | { readonly _tag: "title"; readonly title: string }
  | {
      readonly _tag: "finished";
      readonly durationMs: number;
      readonly outcome: AgentOutcome;
    }
  | { readonly _tag: "failed"; readonly reason: AgentFailure };
