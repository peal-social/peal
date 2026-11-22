import { Option, Result, Schema } from "effect";

import type { Actor } from "#shared/domain/access.ts";
import type { UserId } from "#shared/domain/ids.ts";

/**
 * The agent answers a person in their own session only: never an API key,
 * an OAuth client acting for someone (an MCP client brings a model of its
 * own), nor staff acting as a member, as chats are their author's alone.
 */
export class PersonRequired extends Schema.TaggedError<PersonRequired>()(
  "PersonRequired",
  {}
) {}

/** The person, when the actor is them in their own session. */
export const inPerson = (actor: Actor): Result.Result<UserId, PersonRequired> =>
  actor.subject._tag === "user" &&
  actor.subject.clientId === undefined &&
  Option.isNone(actor.subject.impersonatedBy)
    ? Result.succeed(actor.subject.userId)
    : Result.fail(new PersonRequired());
