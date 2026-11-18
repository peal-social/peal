import { Context, Effect, Layer } from "effect";

import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

import type { DatabaseError } from "./database-error.ts";

/** An erasure's persons to delete at the analytics provider. */
export interface AnalyticsErasureJob {
  /** The erasure it follows, so starting it twice deletes once. */
  readonly key: string;
  readonly userIds: readonly UserId[];
  /** Each workspace's service identity, `workspace:<id>`. */
  readonly workspaceIds: readonly WorkspaceId[];
}

/**
 * Deletes an erasure's persons at the analytics provider, durably: a
 * start inside a TransactionRunner transaction commits, or rolls back,
 * with the erasure, and the deletion is tried again, across restarts,
 * until the provider confirms it or the attempts run out. A start the
 * database refuses fails the erasure with it, to be tried again.
 */
export class AnalyticsErasures extends Context.Service<
  AnalyticsErasures,
  {
    readonly start: (
      job: AnalyticsErasureJob
    ) => Effect.Effect<void, DatabaseError>;
  }
>()("peal-server/shared/application/AnalyticsErasures") {
  /** Starts nothing: for servers and tests that send no events. */
  static readonly none = Layer.succeed(
    AnalyticsErasures,
    AnalyticsErasures.of({ start: () => Effect.void })
  );
}
