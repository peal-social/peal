import { Effect, Option, Ref, Schema } from "effect";
import type { DateTime } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  CompositionAllowanceReached,
  CompositionBusy,
  CompositionNeedsPayment,
  CompositionUnavailable,
  defaultSecondsPerSlide,
  Forbidden,
  SlideshowNotFound,
  SlideshowRequestRejected,
  CurrentMember,
} from "peal-contract";
import type { Permission, Slideshow } from "peal-contract";

import type { Studio } from "./studio.ts";

// The studio's slide videos, composed by a service that answers at once.
// A first caption with "unavailable" stands for a workspace without a
// composition service, "payment" for one whose billing account has no
// payment method, "busy" for one with a slide video on the way,
// "allowance" for one whose day is spent, "refused" for one the service
// refuses. A slide video is `running` the first time it is read, then
// ends. The studio's ready file serves as every image and the voice-over,
// which lasts 12 seconds. An edit asked for whole is queued as it is, in
// the aspect its output names (16:9 when none), refused `editInvalid`
// without a timeline.

// The aspect of an edit's output, as the server reads it.
const EditOutputSchema = Schema.Struct({
  output: Schema.optionalKey(
    Schema.Struct({
      aspectRatio: Schema.optionalKey(Schema.Literals(["16:9", "9:16", "1:1"])),
    })
  ),
  timeline: Schema.Json,
});

const decodeEditOutput = Schema.decodeUnknownOption(EditOutputSchema);

const aspectOfRatio = {
  "16:9": "landscape",
  "1:1": "square",
  "9:16": "portrait",
} as const;

/** A slide video the studio asked for, and how many times it was read. */
export interface StudioSlideshow {
  readonly fails: boolean;
  readonly reads: number;
  readonly slideshow: Slideshow;
}

/** What the slide videos take of the studio, which hands it over. */
export interface SlideshowsWorld {
  readonly allowed: (
    permission: Permission
  ) => Effect.Effect<unknown, Forbidden, CurrentMember>;
  readonly now: DateTime.Utc;
  readonly readyMediaId: string;
  readonly record: (studio: Studio, change: string) => Effect.Effect<void>;
  readonly workspaceId: string;
}

/** The id of the studio's `count + 1`th slide video. */
export const slideshowId = (count: number) =>
  `0190f3a0-0000-7000-8000-${String(count + 1).padStart(10, "0")}5d`;

/** The file a slide video that succeeds becomes. */
export const madeSlideshowId = "0190f3a0-0000-7000-8000-00000000f5f1";

const voiceoverSeconds = 12;

// A read moves a slide video on: running, then ended.
const nextOf = (
  { fails, reads, slideshow }: StudioSlideshow,
  now: DateTime.Utc
): Slideshow => {
  if (reads === 0) {
    return { ...slideshow, startedAt: now, status: "running" };
  }

  return {
    ...slideshow,
    finishedAt: now,
    mediaId: fails ? null : madeSlideshowId,
    reason: fails ? "refused" : null,
    status: fails ? "failed" : "succeeded",
  };
};

/** The studio's slideshows group, over what the rest of it holds. */
export const studioSlideshowsOf = (world: SlideshowsWorld) => {
  const inWorkspace = (workspaceId: string) =>
    workspaceId === world.workspaceId
      ? Effect.void
      : Effect.fail(new Forbidden());

  const read = (studio: Studio, id: string) =>
    Ref.modify(studio.state, (current) => {
      const found = current.slideshows.find((each) => each.slideshow.id === id);

      if (found === undefined) {
        return [Option.none<Slideshow>(), current];
      }

      const next = nextOf(found, world.now);

      return [
        Option.some(next),
        {
          ...current,
          slideshows: current.slideshows.map((each) =>
            each === found
              ? { ...each, reads: each.reads + 1, slideshow: next }
              : each
          ),
        },
      ];
    });

  const groupLive = (studio: Studio) =>
    HttpApiBuilder.group(Api, "media.slideshows", (handlers) =>
      handlers.handleAll({
        create: ({ payload }) =>
          Effect.gen(function* create() {
            yield* world.allowed("assistant:use");
            yield* world.allowed("media:upload");
            yield* inWorkspace((yield* CurrentMember).workspaceId);

            const said = payload.slides[0]?.caption ?? "";

            if (said.includes("unavailable")) {
              return yield* new CompositionUnavailable({ reason: "notSet" });
            }

            if (said.includes("payment")) {
              return yield* new CompositionNeedsPayment({
                billingUrl: "http://localhost:3001/studio/billing",
              });
            }

            if (said.includes("busy")) {
              return yield* new CompositionBusy({
                slideshowId: slideshowId(99),
              });
            }

            if (said.includes("allowance")) {
              return yield* new CompositionAllowanceReached({
                dailyLimit: 20,
                resetsAt: world.now,
              });
            }

            const known = (id: string) => id === world.readyMediaId;

            if (!payload.slides.every(({ mediaId }) => known(mediaId))) {
              return yield* new SlideshowRequestRejected({
                reason: "imageNotFound",
              });
            }

            if (
              payload.voiceoverMediaId !== undefined &&
              !known(payload.voiceoverMediaId)
            ) {
              return yield* new SlideshowRequestRejected({
                reason: "voiceoverNotFound",
              });
            }

            const count = payload.slides.length;

            const seconds =
              payload.secondsPerSlide ??
              (payload.voiceoverMediaId === undefined
                ? defaultSecondsPerSlide
                : voiceoverSeconds / count);

            const { slideshows } = yield* Ref.get(studio.state);

            const slideshow: Slideshow = {
              aspect: payload.aspect,
              createdAt: world.now,
              durationSeconds: seconds * count,
              finishedAt: null,
              id: slideshowId(slideshows.length),
              imageMediaIds: payload.slides.map(({ mediaId }) => mediaId),
              mediaId: null,
              reason: null,
              sandbox: false,
              startedAt: null,
              status: "queued",
              voiceoverMediaId: payload.voiceoverMediaId ?? null,
            };

            yield* Ref.update(studio.state, (current) => ({
              ...current,
              slideshows: [
                ...current.slideshows,
                { fails: said.includes("refused"), reads: 0, slideshow },
              ],
            }));

            const slides = payload.slides
              .map(
                ({ caption, motion }) => `${caption ?? "-"}/${motion ?? "-"}`
              )
              .join(",");

            yield* world.record(
              studio,
              `slideshow:${payload.aspect}:${String(payload.secondsPerSlide ?? "-")}:${payload.transition ?? "-"}:${payload.voiceoverMediaId ?? "-"}:${slides}:${slideshow.id}`
            );

            return slideshow;
          }),
        createFromEdit: ({ payload }) =>
          Effect.gen(function* createFromEdit() {
            yield* world.allowed("assistant:use");
            yield* world.allowed("media:upload");
            yield* inWorkspace((yield* CurrentMember).workspaceId);

            const given = decodeEditOutput(payload.edit);

            if (Option.isNone(given)) {
              return yield* new SlideshowRequestRejected({
                reason: "editInvalid",
              });
            }

            const { slideshows } = yield* Ref.get(studio.state);

            const slideshow: Slideshow = {
              aspect: aspectOfRatio[given.value.output?.aspectRatio ?? "16:9"],
              createdAt: world.now,
              durationSeconds: 0,
              finishedAt: null,
              id: slideshowId(slideshows.length),
              imageMediaIds: [],
              mediaId: null,
              reason: null,
              sandbox: false,
              startedAt: null,
              status: "queued",
              voiceoverMediaId: null,
            };

            yield* Ref.update(studio.state, (current) => ({
              ...current,
              slideshows: [
                ...current.slideshows,
                { fails: false, reads: 0, slideshow },
              ],
            }));

            yield* world.record(studio, `slideshow-edit:${slideshow.id}`);

            return slideshow;
          }),
        get: ({ params }) =>
          Effect.gen(function* get() {
            yield* world.allowed("assistant:use");
            yield* inWorkspace((yield* CurrentMember).workspaceId);

            const found = yield* read(studio, params.slideshowId);

            return yield* Option.match(found, {
              onNone: () => Effect.fail(new SlideshowNotFound()),
              onSome: Effect.succeed,
            });
          }),
        list: ({ query }) =>
          Effect.gen(function* list() {
            yield* world.allowed("assistant:use");
            yield* inWorkspace((yield* CurrentMember).workspaceId);

            const { slideshows } = yield* Ref.get(studio.state);

            return {
              slideshows: slideshows
                .map(({ slideshow }) => slideshow)
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
