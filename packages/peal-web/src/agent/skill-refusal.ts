import { Cause, Exit, Option, Schema } from "effect";
import { Forbidden } from "peal-contract";
import { AgentSkillNotFound, AgentSkillRefused } from "peal-contract/agent";
import type { AgentSkillRefusal } from "peal-contract/agent";

/**
 * Why a skill could not be saved or deleted, as the settings page says
 * it: the contract's reasons, a skill that is gone, a role that may not
 * use the agent, or anything else (the network, an answer not read).
 */
export type SkillProblem =
  | AgentSkillRefusal
  | "forbidden"
  | "notFound"
  | "unexpected";

const isRefused = Schema.is(AgentSkillRefused);

const isNotFound = Schema.is(AgentSkillNotFound);

const isForbidden = Schema.is(Forbidden);

/** What an exit that failed says to the person; null for a success. */
export const skillProblemOf = <A, E>(
  exit: Exit.Exit<A, E>
): SkillProblem | null => {
  if (Exit.isSuccess(exit)) {
    return null;
  }

  const found = Cause.findErrorOption(exit.cause);

  if (Option.isNone(found)) {
    return "unexpected";
  }

  const error = found.value;

  if (isRefused(error)) {
    return error.reason;
  }

  if (isNotFound(error)) {
    return "notFound";
  }

  return isForbidden(error) ? "forbidden" : "unexpected";
};
