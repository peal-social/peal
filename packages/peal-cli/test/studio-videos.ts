import { Effect, Option, Ref } from "effect";
import type { DateTime } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  AssistantInputRejected,
  Forbidden,
  maxVideoPromptLength,
  VideoAllowanceReached,
  VideoBusy,
  VideoGenerationNotFound,
  VideoRequestRejected,
  VideoUnavailable,
} from "peal-contract";
import type { CurrentMember, Permission, VideoGeneration } from "peal-contract";

import type { Studio } from "./studio.ts";

// The studio's videos, made by a provider that answers at once. A prompt
// with "unavailable" stands for a workspace without a video model, "busy"
// for one with a video on the way, "allowance" for one whose day is spent,
// "refused" for one the provider refuses. A video is `running` the first
// time it is read, then ends.

/** A video the studio asked for, and how many times it was read. */
export interface StudioVideo {
  readonly fails: boolean;
  readonly generation: VideoGeneration;
  readonly reads: number;
}

/** What the videos take of the studio, which hands it over. */
export interface VideosWorld {
  readonly allowed: (
    permission: Permission
  ) => Effect.Effect<unknown, Forbidden, CurrentMember>;
  readonly now: DateTime.Utc;
  readonly readyImageId: string;
  readonly record: (studio: Studio, change: string) => Effect.Effect<void>;
  readonly workspaceId: string;
}

/** The id of the studio's `count + 1`th video. */
export const videoId = (count: number) =>
  `0190f3a0-0000-7000-8000-${String(count + 1).padStart(12, "0")}`;

/** The file a video that succeeds becomes. */
export const madeVideoId = "0190f3a0-0000-7000-8000-00000000f0f1";

// A read moves a video on: running, then ended.
const nextOf = (
  { fails, generation, reads }: StudioVideo,
  now: DateTime.Utc
): VideoGeneration => {
  if (reads === 0) {
    return { ...generation, startedAt: now, status: "running" };
  }

  return {
    ...generation,
    finishedAt: now,
    mediaId: fails ? null : madeVideoId,
    reason: fails ? "refused" : null,
    status: fails ? "failed" : "succeeded",
  };
};

/** The studio's video group, over what the rest of it holds. */
export const studioVideosOf = (world: VideosWorld) => {
  const inWorkspace = (workspaceId: string) =>
    workspaceId === world.workspaceId
      ? Effect.void
      : Effect.fail(new Forbidden());

  const read = (studio: Studio, id: string) =>
    Ref.modify(studio.state, (current) => {
      const found = current.videos.find((each) => each.generation.id === id);

      if (found === undefined) {
        return [Option.none<VideoGeneration>(), current];
      }

      const next = nextOf(found, world.now);

      return [
        Option.some(next),
        {
          ...current,
          videos: current.videos.map((each) =>
            each === found
              ? { ...each, generation: next, reads: each.reads + 1 }
              : each
          ),
        },
      ];
    });

  const groupLive = (studio: Studio) =>
    HttpApiBuilder.group(Api, "videoGenerations", (handlers) =>
      handlers.handleAll({
        create: ({ params, payload }) =>
          Effect.gen(function* create() {
            yield* world.allowed("assistant:use");
            yield* world.allowed("media:upload");
            yield* inWorkspace(params.workspaceId);

            const prompt = payload.prompt.trim();

            if (prompt.length === 0) {
              return yield* new AssistantInputRejected({
                maxLength: maxVideoPromptLength,
                reason: "empty",
              });
            }

            if (prompt.includes("unavailable")) {
              return yield* new VideoUnavailable({ reason: "notSet" });
            }

            if (prompt.includes("busy")) {
              return yield* new VideoBusy({ generationId: videoId(99) });
            }

            if (prompt.includes("allowance")) {
              return yield* new VideoAllowanceReached({
                dailyLimit: 20,
                resetsAt: world.now,
              });
            }

            if (
              payload.imageMediaId !== undefined &&
              payload.imageMediaId !== world.readyImageId
            ) {
              return yield* new VideoRequestRejected({
                reason: "imageNotFound",
              });
            }

            const { videos } = yield* Ref.get(studio.state);

            const generation: VideoGeneration = {
              aspect: payload.aspect,
              createdAt: world.now,
              durationSeconds: payload.durationSeconds ?? null,
              finishedAt: null,
              id: videoId(videos.length),
              imageMediaId: payload.imageMediaId ?? null,
              mediaId: null,
              reason: null,
              startedAt: null,
              status: "queued",
            };

            yield* Ref.update(studio.state, (current) => ({
              ...current,
              videos: [
                ...current.videos,
                { fails: prompt.includes("refused"), generation, reads: 0 },
              ],
            }));
            yield* world.record(
              studio,
              `video:${payload.aspect}:${String(payload.durationSeconds ?? "-")}:${payload.imageMediaId ?? "-"}:${generation.id}`
            );

            return generation;
          }),
        get: ({ params }) =>
          Effect.gen(function* get() {
            yield* world.allowed("assistant:use");
            yield* inWorkspace(params.workspaceId);

            const found = yield* read(studio, params.generationId);

            return yield* Option.match(found, {
              onNone: () => Effect.fail(new VideoGenerationNotFound()),
              onSome: Effect.succeed,
            });
          }),
        list: ({ params, query }) =>
          Effect.gen(function* list() {
            yield* world.allowed("assistant:use");
            yield* inWorkspace(params.workspaceId);

            const { videos } = yield* Ref.get(studio.state);

            return {
              generations: videos
                .map(({ generation }) => generation)
                .filter(
                  ({ status }) =>
                    query.status === undefined || status === query.status
                )
                .toReversed(),
            };
          }),
      })
    );

  return { groupLive };
};
