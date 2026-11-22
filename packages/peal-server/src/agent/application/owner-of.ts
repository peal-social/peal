import { Effect } from "effect";

import type { ChatOwner } from "#agent/application/ports/agent-chats.ts";
import { inPerson } from "#agent/domain/person-required.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";

/**
 * The person every use case of the agent acts for: in their own session,
 * with `assistant:use`.
 */
export const ownerOf = (actor: Actor) =>
  Effect.gen(function* owner() {
    yield* Effect.fromResult(authorize(actor, "assistant:use"));

    const userId = yield* Effect.fromResult(inPerson(actor));

    const owned: ChatOwner = { userId, workspaceId: actor.workspaceId };

    return owned;
  });
