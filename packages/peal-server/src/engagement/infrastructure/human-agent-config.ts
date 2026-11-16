import { Config, Layer } from "effect";

import { CurrentHumanAgent } from "#engagement/application/current-human-agent.ts";

/**
 * `PEAL_META_HUMAN_AGENT`: `true` once Meta's App Review granted the
 * server's app the Human Agent feature (with business verification), so a
 * member answering in person may answer a Messenger or Instagram
 * conversation for 7 days after the person's last message; `false` when
 * unset. Any other value stops the server. It does nothing on a server
 * whose `PEAL_INBOX_MESSAGES` names neither `facebook` nor `instagram`.
 */
export const humanAgentConfig = Config.Boolean("PEAL_META_HUMAN_AGENT").pipe(
  Config.withDefault(false)
);

/** Whether a person's answer may use Meta's Human Agent tag, as the operator set it. */
export const HumanAgentLive = Layer.effect(CurrentHumanAgent, humanAgentConfig);
