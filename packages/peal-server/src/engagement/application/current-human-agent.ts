import { Context } from "effect";

/**
 * Whether this server's Meta app holds the Human Agent feature, as its
 * operator says (`PEAL_META_HUMAN_AGENT`), read once when it starts: a
 * member answering in person, in their own session, may then answer a
 * Messenger or Instagram conversation until 7 days after the person's
 * last message, with Meta's `HUMAN_AGENT` tag. Off unless the
 * composition root says otherwise.
 */
export const CurrentHumanAgent = Context.Reference<boolean>(
  "peal-server/engagement/application/CurrentHumanAgent",
  { defaultValue: () => false }
);
