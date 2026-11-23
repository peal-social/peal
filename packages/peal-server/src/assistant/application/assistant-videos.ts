import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { GeneratedVideos } from "#assistant/application/ports/generated-videos.ts";
import { VideoGenerationStore } from "#assistant/application/ports/video-generation-store.ts";
import { VideoJobs } from "#assistant/application/ports/video-jobs.ts";
import { VideoNotices } from "#assistant/application/ports/video-notices.ts";
import { VideoBusy } from "#assistant/application/video-busy.ts";
import { VideoGenerationNotFound } from "#assistant/application/video-generation-not-found.ts";
import { VideoUnavailable } from "#assistant/application/video-unavailable.ts";
import { openVideoUse } from "#assistant/application/video-uses.ts";
import type { OpenedVideoUse } from "#assistant/application/video-uses.ts";
import { VideosExhausted } from "#assistant/application/videos-exhausted.ts";
import type { DraftRejected } from "#assistant/domain/draft-rejected.ts";
import type { ImageAspect } from "#assistant/domain/image-aspect.ts";
import { remainingOf, usageWindowAt } from "#assistant/domain/usage-window.ts";
import {
  checkVideoPrompt,
  VideoGeneration,
  VideoGenerationIdSchema,
} from "#assistant/domain/video-generation.ts";
import type { VideoStatus } from "#assistant/domain/video-generation.ts";
import {
  maxVideoPromptLength,
  staleVideoAfter,
  videosPerDay,
} from "#assistant/domain/video-limits.ts";
import { checkVideoAsk } from "#assistant/domain/video-provider.ts";
import type { VideoProviderId } from "#assistant/domain/video-provider.ts";
import { VideoRejected } from "#assistant/domain/video-rejected.ts";
import { newId } from "#shared/application/ids.ts";
import type { Ids } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

import type { CapabilityModels } from "./ports/capability-models.ts";
import type { ProviderConnections } from "./ports/provider-connections.ts";

/** What a member asks a video of. */
export interface VideoAsked {
  readonly aspect: ImageAspect;
  /** Null to leave the length to the provider. */
  readonly durationSeconds: number | null;
  /** A ready image of the library to start from, by its id. */
  readonly imageMediaId: string | null;
  readonly prompt: string;
}

/** Whether the workspace makes videos, and how many are left today. */
export interface VideosStatus {
  readonly available: boolean;
  readonly dailyLimit: number;
  readonly maxPromptLength: number;
  readonly provider: VideoProviderId | null;
  readonly remaining: number;
}

export type RequestVideoFailure =
  | DraftRejected
  | MissingPermission
  | PlanLimitReached
  | VideoBusy
  | VideoRejected
  | VideosExhausted
  | VideoUnavailable;

/** The most jobs a list answers (the contract's `maxVideoGenerationsListed`). */
export const maxVideosListed = 50;

const decodeAssetId = Schema.decodeUnknownOption(MediaAssetIdSchema);

// The provider chosen for videos, whether or not its key opens.
const providerOf = (use: OpenedVideoUse): VideoProviderId | null => {
  if (use._tag === "open") {
    return use.endpoint.provider;
  }

  return use._tag === "keyUnreadable" ? use.provider : null;
};

const decodeGenerationId = Schema.decodeUnknownOption(VideoGenerationIdSchema);

type VideoPorts =
  | CapabilityModels
  | GeneratedVideos
  | Ids
  | ProviderConnections
  | TransactionRunner
  | VideoGenerationStore
  | VideoJobs
  | VideoNotices;

/**
 * Videos made into a workspace's media library by the provider it chose
 * for videos, with its own key, each a durable job (`RunVideoGeneration`
 * runs it). Asking needs assistant:use and media:upload, reading
 * assistant:use; staff acting as a member ask for none, as the
 * workspace's account at its provider pays. Nothing of Peal's allowance
 * is read or counted: the job is bounded by one at a time a workspace
 * and `videosPerDay` a UTC day, whatever each ends with.
 */
export class AssistantVideos extends Context.Service<
  AssistantVideos,
  {
    /**
     * Checks the request against the provider chosen, the first frame and
     * the plan's storage, then records the job and starts it, in one
     * transaction: queued, for its job to make.
     */
    readonly request: (
      actor: Actor,
      asked: VideoAsked
    ) => Effect.Effect<VideoGeneration, RequestVideoFailure>;
    readonly view: (
      actor: Actor,
      id: string
    ) => Effect.Effect<
      VideoGeneration,
      MissingPermission | VideoGenerationNotFound
    >;
    /** The workspace's jobs, newest first, `maxVideosListed` at most. */
    readonly list: (
      actor: Actor,
      status: Option.Option<VideoStatus>
    ) => Effect.Effect<readonly VideoGeneration[], MissingPermission>;
    readonly status: (
      actor: Actor
    ) => Effect.Effect<VideosStatus, MissingPermission>;
  }
>()("peal-server/assistant/application/AssistantVideos") {
  static readonly layer = Layer.effect(
    AssistantVideos,
    Effect.gen(function* AssistantVideosLive() {
      const ports = yield* Effect.context<VideoPorts>();

      const reading = <A, E>(
        actor: Actor,
        useCase: Effect.Effect<A, E, VideoPorts>
      ): Effect.Effect<A, E | MissingPermission> =>
        Effect.fromResult(authorize(actor, "assistant:use")).pipe(
          Effect.andThen(useCase),
          Effect.provideContext(ports)
        );

      const request = Effect.fn("AssistantVideos.request")(function* request(
        actor: Actor,
        asked: VideoAsked
      ) {
        yield* Effect.fromResult(authorize(actor, "assistant:use"));
        yield* Effect.fromResult(authorize(actor, "media:upload"));

        // Staff acting as a member would spend the workspace's account at
        // its provider: the member does it themselves.
        if (
          actor.subject._tag === "user" &&
          Option.isSome(actor.subject.impersonatedBy)
        ) {
          return yield* new MissingPermission({
            permission: "assistant:configure",
          });
        }

        const prompt = yield* Effect.fromResult(checkVideoPrompt(asked.prompt));
        const { workspaceId } = actor;
        const use = yield* openVideoUse(workspaceId);

        if (use._tag !== "open") {
          return yield* new VideoUnavailable({ reason: use._tag });
        }

        yield* Effect.fromResult(
          checkVideoAsk(use.endpoint.provider, {
            aspect: asked.aspect,
            durationSeconds: asked.durationSeconds,
            withImage: asked.imageMediaId !== null,
          })
        );

        const videos = yield* GeneratedVideos;

        const imageMediaId =
          asked.imageMediaId === null
            ? Option.none()
            : decodeAssetId(asked.imageMediaId);

        if (asked.imageMediaId !== null) {
          const found = Option.isSome(imageMediaId)
            ? yield* videos.isImage(workspaceId, imageMediaId.value)
            : false;

          if (!found) {
            return yield* new VideoRejected({ reason: "imageNotFound" });
          }
        }

        // The largest video Peal keeps must fit before anything is asked.
        yield* videos.roomFor(workspaceId);

        const now = yield* DateTime.now;
        const window = usageWindowAt(now);

        const generation = new VideoGeneration({
          aspect: asked.aspect,
          createdAt: now,
          durationSeconds: Option.fromNullishOr(asked.durationSeconds),
          finishedAt: Option.none(),
          id: yield* newId(VideoGenerationIdSchema),
          imageMediaId,
          mediaId: Option.none(),
          reason: Option.none(),
          requestedBy:
            actor.subject._tag === "user"
              ? Option.some(actor.subject.userId)
              : Option.none(),
          startedAt: Option.none(),
          status: "queued",
          workspaceId,
        });

        const store = yield* VideoGenerationStore;
        const jobs = yield* VideoJobs;
        const notices = yield* VideoNotices;
        const { transaction } = yield* TransactionRunner;

        // The row and its job's start commit together, or not at all.
        const started = yield* transaction(
          Effect.gen(function* recording() {
            const outcome = yield* store.start(generation, prompt, {
              dailyLimit: videosPerDay,
              dayStart: DateTime.subtractDuration(window.resetsAt, "1 day"),
              now,
              staleBefore: DateTime.subtractDuration(now, staleVideoAfter),
            });

            if (outcome._tag === "started") {
              yield* jobs.start(generation.id);
              yield* Effect.forEach(outcome.interrupted, notices.ended, {
                discard: true,
              });
            }

            return outcome;
          })
        ).pipe(Effect.catchTag("DatabaseError", Effect.die));

        if (started._tag === "busy") {
          return yield* new VideoBusy({ generationId: started.generationId });
        }

        if (started._tag === "exhausted") {
          return yield* new VideosExhausted({
            dailyLimit: videosPerDay,
            resetsAt: window.resetsAt,
          });
        }

        return generation;
      });

      const view = (actor: Actor, id: string) =>
        reading(
          actor,
          Effect.gen(function* viewing() {
            const decoded = decodeGenerationId(id);

            const found = Option.isSome(decoded)
              ? yield* VideoGenerationStore.use((store) =>
                  store.get(actor.workspaceId, decoded.value)
                )
              : Option.none<VideoGeneration>();

            return yield* Option.match(found, {
              onNone: () => Effect.fail(new VideoGenerationNotFound()),
              onSome: Effect.succeed,
            });
          })
        );

      const status = (actor: Actor) =>
        reading(
          actor,
          Effect.gen(function* videoStatus() {
            const now = yield* DateTime.now;
            const window = usageWindowAt(now);
            const use = yield* openVideoUse(actor.workspaceId);

            const used = yield* VideoGenerationStore.use((store) =>
              store.countSince(
                actor.workspaceId,
                DateTime.subtractDuration(window.resetsAt, "1 day")
              )
            );

            const videosStatus: VideosStatus = {
              available: use._tag === "open",
              dailyLimit: videosPerDay,
              maxPromptLength: maxVideoPromptLength,
              provider: providerOf(use),
              remaining: remainingOf(videosPerDay, used),
            };

            return videosStatus;
          })
        );

      return AssistantVideos.of({
        list: (actor, wanted) =>
          reading(
            actor,
            VideoGenerationStore.use((store) =>
              store.list(actor.workspaceId, wanted, maxVideosListed)
            )
          ),
        request: (actor, asked) =>
          request(actor, asked).pipe(Effect.provideContext(ports)),
        status,
        view,
      });
    })
  );
}
