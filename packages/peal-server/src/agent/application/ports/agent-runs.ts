import { Context } from "effect";
import type { Effect, Option, Scope, Stream } from "effect";

import type { AgentModelOff } from "#agent/application/agent-model-off.ts";
import type { DayExhausted } from "#agent/application/day-exhausted.ts";
import type { OwnProviderBusy } from "#agent/application/own-provider-busy.ts";
import type { ChatRun } from "#agent/application/ports/agent-chats.ts";
import type { AgentEvent } from "#agent/domain/agent-event.ts";
import type { AgentAvailability } from "#agent/domain/agent-parts.ts";
import type { PersonRequired } from "#agent/domain/person-required.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { AllowanceReached } from "#shared/domain/allowance-reached.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { TimeZoneId } from "#shared/domain/time-zone.ts";

/** Where the request that started a run came from, as the server received it. */
export interface RequestOrigin {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly remoteAddress: Option.Option<string>;
}

/** What the person sent: a message, or their answer to a change. */
export type RunInput =
  | { readonly _tag: "message"; readonly text: string }
  | {
      readonly _tag: "answer";
      readonly approved: boolean;
      readonly callId: string;
    };

/** A run of the agent, on a chat its author claimed. */
export interface RunRequest {
  readonly actor: Actor;
  readonly chat: ChatRun;
  readonly input: RunInput;
  readonly origin: RequestOrigin;
  readonly timeZone: TimeZoneId;
}

/** What refuses a run before its events start. */
export type RunRefusal =
  | AgentModelOff
  | AllowanceReached
  | DayExhausted
  | MissingPermission
  | OwnProviderBusy
  | PersonRequired;

/**
 * The agent's model, its tools and their records: who answers a person
 * (the workspace's own text provider, else the server's model, as the
 * writing assistant chooses), and a run, as a stream of its events. A run
 * keeps what it writes as it goes, its answer and what the model reads of
 * the chat, and keeps it too when the stream is closed before its end
 * (`stopped`). Never logs or traces a message, a prompt, a tool's
 * parameters or answer, or a provider's error.
 */
export class AgentRuns extends Context.Service<
  AgentRuns,
  {
    readonly availability: (actor: Actor) => Effect.Effect<AgentAvailability>;
    /**
     * Opens the run: who answers, the first round's request claimed, and
     * the resources it holds for the scope; refused before any event.
     */
    readonly start: (
      request: RunRequest
    ) => Effect.Effect<Stream.Stream<AgentEvent>, RunRefusal, Scope.Scope>;
  }
>()("peal-server/agent/application/AgentRuns") {}
