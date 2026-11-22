import { Cause, Exit, Option, Schema } from "effect";
import {
  AssistantInputRejected,
  AssistantQuotaExceeded,
  AssistantUnavailable,
  Forbidden,
  OwnTextLimitReached,
  TextProviderBusy,
  UsageAllowanceReached,
} from "peal-contract";
import {
  AgentApprovalNotPending,
  AgentBusy,
  AgentChatNotFound,
} from "peal-contract/agent";

/**
 * Why the server refused a run before its events started, as the contract
 * declares it, or `Unexpected` for the network and an answer that could
 * not be read.
 */
export type RunRefusal =
  | AgentApprovalNotPending
  | AgentBusy
  | AgentChatNotFound
  | AssistantInputRejected
  | AssistantQuotaExceeded
  | AssistantUnavailable
  | Forbidden
  | OwnTextLimitReached
  | TextProviderBusy
  | UsageAllowanceReached
  | { readonly _tag: "Unexpected" };

const isRefusal = Schema.is(
  Schema.Union([
    AgentApprovalNotPending,
    AgentBusy,
    AgentChatNotFound,
    AssistantInputRejected,
    AssistantQuotaExceeded,
    AssistantUnavailable,
    Forbidden,
    OwnTextLimitReached,
    TextProviderBusy,
    UsageAllowanceReached,
  ])
);

const unexpected: RunRefusal = { _tag: "Unexpected" };

/** The refusal an exit ended with, or `Unexpected` for any other end. */
export const refusalOf = <A, E>(exit: Exit.Exit<A, E>): RunRefusal =>
  Exit.isFailure(exit)
    ? Cause.findErrorOption(exit.cause).pipe(
        Option.filter(isRefusal),
        Option.getOrElse(() => unexpected)
      )
    : unexpected;

/**
 * Whether the chat must be read again after the refusal: an approval
 * already answered, or a chat that is gone, says the chat moved on.
 */
export const rereadsChat = (refusal: RunRefusal): boolean =>
  refusal._tag === "AgentApprovalNotPending" ||
  refusal._tag === "AgentChatNotFound";
