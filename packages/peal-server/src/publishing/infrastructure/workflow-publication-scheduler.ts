import { Effect, Layer, Option } from "effect";
import { WorkflowEngine } from "effect/workflow";

import {
  ExecutionIdSchema,
  PublicationScheduler,
} from "#publishing/application/publication-scheduler.ts";

import { PublishTargetV2 } from "./workflows/publish-parts.ts";
import { postJobVersion, PublishPostV1 } from "./workflows/publish-post.ts";
import { PublishTargetV1 } from "./workflows/publish-target.ts";
import { SiteHoldV1 } from "./workflows/site-hold.ts";

/**
 * Starts and interrupts PublishPostV1 executions, starts the
 * PublishTargetV2 execution of a reposted round, with no parent, and
 * starts and interrupts a target's hand-overs (SiteHoldV1). A start is a
 * persisted message: inside a TransactionRunner transaction it commits, or
 * rolls back, with the post, and the execution only runs after the commit.
 */
export const WorkflowPublicationScheduler = Layer.effect(
  PublicationScheduler,
  Effect.gen(function* WorkflowPublicationScheduler() {
    const engine = yield* WorkflowEngine.WorkflowEngine;

    const withEngine = Effect.provideService(
      WorkflowEngine.WorkflowEngine,
      engine
    );

    return PublicationScheduler.of({
      cancel: (executionId) =>
        PublishPostV1.interrupt(executionId).pipe(withEngine),
      cancelFollow: ({ channelId, handOver, targetId }) =>
        Effect.gen(function* stopHandOver() {
          yield* SiteHoldV1.interrupt(
            yield* SiteHoldV1.executionId({ channelId, handOver, targetId })
          );
        }).pipe(withEngine),
      // A round is one execution, whichever version of the job runs it.
      cancelRound: ({ round, targetId }) =>
        Effect.gen(function* stopRound() {
          const payload = { codeVersion: 1, round, targetId };

          yield* PublishTargetV2.interrupt(
            yield* PublishTargetV2.executionId(payload)
          );
          yield* PublishTargetV1.interrupt(
            yield* PublishTargetV1.executionId(payload)
          );
        }).pipe(withEngine),
      follow: ({ channelId, handOver, sitePostId, targetId }) =>
        SiteHoldV1.execute(
          Option.match(sitePostId, {
            onNone: () => ({ channelId, handOver, targetId }),
            onSome: (platformPostId) => ({
              channelId,
              handOver,
              sitePostId: platformPostId,
              targetId,
            }),
          }),
          { discard: true }
        ).pipe(withEngine, Effect.asVoid),
      repost: ({ round, targetId }) =>
        PublishTargetV2.execute(
          { codeVersion: 1, round, targetId },
          { discard: true }
        ).pipe(withEngine, Effect.asVoid),
      schedule: ({ postId, revision, scheduledAt }) =>
        PublishPostV1.execute(
          { codeVersion: postJobVersion, postId, revision, scheduledAt },
          { discard: true }
        ).pipe(
          withEngine,
          Effect.map((executionId) => ExecutionIdSchema.make(executionId))
        ),
    });
  })
);
