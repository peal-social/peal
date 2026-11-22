import { DateTime, Effect, Layer, Option, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { CurrentMember } from "peal-contract";
import type { Member } from "peal-contract";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import type { AgentEvent } from "#agent/domain/agent-event.ts";
import { DrizzleAgentChatsLive } from "#agent/infrastructure/drizzle-agent-chats.ts";
import { LanguageModelAgentRunsLive } from "#agent/infrastructure/language-model-agent-runs.ts";
import { AgentModelAccess } from "#assistant/application/agent-model-access.ts";
import { DrizzleAssistantUsageLive } from "#assistant/infrastructure/drizzle-assistant-usage.ts";
import { Ids } from "#shared/application/ids.ts";
import type { MeteredUsage } from "#shared/application/metered-usage.ts";
import { Actor } from "#shared/domain/access.ts";
import type { Permission } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import {
  FakeAgentModelLive,
  FakeLanguageModelsLive,
} from "#test/agent/fake-agent-model.ts";
import { FakeToolboxLive } from "#test/agent/fake-tools.ts";
import { allowanceOf, assistantTest } from "#test/assistant/support.ts";
import type { FakeMetersLedger } from "#test/shared/support.ts";
import { fakeMeters } from "#test/shared/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

export { DatabaseTest } from "#test/assistant/support.ts";

export {
  calls,
  FakeAgentModel,
  fails,
  says,
  saysThenCalls,
  silence,
} from "#test/agent/fake-agent-model.ts";

export type { Round } from "#test/agent/fake-agent-model.ts";

export { FakeTools, postId } from "#test/agent/fake-tools.ts";

/**
 * The agent as the server wires it, on the fake model and tools, the
 * assistant's real allowances (`dailyRequests` a day off billing, or the
 * meters given, `metered`), and the agent's tables. Built for each test;
 * it needs DatabaseTest.
 */
export const agentTest = ({
  dailyRequests = 50,
  meters = fakeMeters({ allowed: Option.none() }),
  metered = false,
  model = "fake",
}: {
  readonly dailyRequests?: number;
  readonly meters?: Layer.Layer<MeteredUsage | FakeMetersLedger>;
  readonly metered?: boolean;
  readonly model?: "fake" | "off";
} = {}) =>
  Layer.mergeAll(AgentDesk.layer, AgentRecords.layer).pipe(
    Layer.provide(LanguageModelAgentRunsLive),
    Layer.provideMerge(DrizzleAgentChatsLive),
    Layer.provide(
      AgentModelAccess.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            DrizzleAssistantUsageLive,
            allowanceOf(dailyRequests, dailyRequests, metered)
          )
        )
      )
    ),
    Layer.provideMerge(FakeToolboxLive),
    Layer.provideMerge(FakeLanguageModelsLive),
    Layer.provideMerge(FakeAgentModelLive),
    Layer.provideMerge(assistantTest({ dailyRequests, meters, metered, model }))
  );

/** Someone in a workspace, as the API's WorkspaceAccess gives them. */
export interface Person {
  readonly actor: Actor;
  readonly member: Member;
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
}

/** A person in their own session, with an editor's permissions by default. */
export const personIn = (
  workspaceId: WorkspaceId,
  userId: UserId,
  permissions: readonly Permission[] = permissionsFor("editor")
): Person => ({
  actor: new Actor({
    permissions,
    subject: { _tag: "user", impersonatedBy: Option.none(), userId },
    workspaceId,
  }),
  member: {
    permissions,
    principal: { _tag: "user", impersonatedBy: null, userId },
    workspaceId,
  },
  userId,
  workspaceId,
});

/**
 * A workspace and a person no other test uses, whose chats, usage and
 * provider rows go when the test ends.
 */
export const freshPerson = Effect.gen(function* freshPerson() {
  const workspaceId = WorkspaceIdSchema.make(yield* Ids.use((ids) => ids.next));
  const userId = UserIdSchema.make(yield* Ids.use((ids) => ids.next));
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.addFinalizer(() =>
    sql`DELETE FROM agent.chats WHERE workspace_id = ${workspaceId}`.pipe(
      Effect.andThen(
        sql`DELETE FROM assistant.daily_usage WHERE workspace_id = ${workspaceId}`
      ),
      Effect.andThen(
        sql`DELETE FROM assistant.text_providers WHERE workspace_id = ${workspaceId}`
      ),
      Effect.andThen(
        sql`DELETE FROM assistant.own_text_days WHERE workspace_id = ${workspaceId}`
      ),
      Effect.ignore
    )
  );

  return personIn(workspaceId, userId);
});

/** The person's events of a run, to its end, as the API would stream them. */
export const runEvents = <E, R>(
  person: Person,
  run: (
    desk: AgentDesk["Service"]
  ) => Effect.Effect<Stream.Stream<AgentEvent>, E, R>
) =>
  AgentDesk.use(run).pipe(
    Effect.flatMap(Stream.runCollect),
    Effect.provideService(CurrentMember, person.member)
  );

/** A time far enough in the past for the retention to take it. */
export const longAgo = (days: number) =>
  DateTime.now.pipe(Effect.map(DateTime.subtract({ days })));
