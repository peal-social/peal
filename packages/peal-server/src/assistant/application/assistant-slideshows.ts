import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import { CompositionBusy } from "#assistant/application/composition-busy.ts";
import { CompositionNeedsPayment } from "#assistant/application/composition-needs-payment.ts";
import { CompositionUnavailable } from "#assistant/application/composition-unavailable.ts";
import { openCompositionUse } from "#assistant/application/composition-uses.ts";
import type { OpenedCompositionUse } from "#assistant/application/composition-uses.ts";
import { SlideshowJobs } from "#assistant/application/ports/slideshow-jobs.ts";
import { SlideshowMedia } from "#assistant/application/ports/slideshow-media.ts";
import { SlideshowNotices } from "#assistant/application/ports/slideshow-notices.ts";
import { SlideshowStore } from "#assistant/application/ports/slideshow-store.ts";
import { SlideshowNotFound } from "#assistant/application/slideshow-not-found.ts";
import { SlideshowsExhausted } from "#assistant/application/slideshows-exhausted.ts";
import type { CompositionProviderId } from "#assistant/domain/composition-provider.ts";
import type { ImageAspect } from "#assistant/domain/image-aspect.ts";
import { slideshowLengthOf } from "#assistant/domain/slideshow-length.ts";
import {
  slideshowsPerDay,
  staleSlideshowAfter,
} from "#assistant/domain/slideshow-limits.ts";
import { SlideshowRejected } from "#assistant/domain/slideshow-rejected.ts";
import { Slideshow, SlideshowIdSchema } from "#assistant/domain/slideshow.ts";
import type {
  PlannedSlide,
  SlideMotion,
  SlidePlan,
  SlideshowStatus,
  SlideTransition,
} from "#assistant/domain/slideshow.ts";
import { remainingOf, usageWindowAt } from "#assistant/domain/usage-window.ts";
import { newId } from "#shared/application/ids.ts";
import type { Ids } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

import type { CapabilityModels } from "./ports/capability-models.ts";
import type { ProviderConnections } from "./ports/provider-connections.ts";

/** One slide a member asks for. */
export interface SlideAsked {
  readonly caption: string | null;
  readonly mediaId: string;
  readonly motion: SlideMotion;
}

/** What a member asks a slide video of. */
export interface SlideshowAsked {
  readonly aspect: ImageAspect;
  /** Null to fit the voice-over, or else the default. */
  readonly secondsPerSlide: number | null;
  readonly slides: readonly SlideAsked[];
  readonly transition: SlideTransition;
  readonly voiceoverMediaId: string | null;
}

/** Whether the workspace composes slide videos, and how many are left today. */
export interface SlideshowsStatus {
  readonly available: boolean;
  readonly dailyLimit: number;
  readonly paymentMethodRequired: boolean;
  readonly provider: CompositionProviderId | null;
  readonly remaining: number;
  readonly sandbox: boolean;
}

export type RequestSlideshowFailure =
  | CompositionBusy
  | CompositionNeedsPayment
  | CompositionUnavailable
  | MissingPermission
  | PlanLimitReached
  | SlideshowRejected
  | SlideshowsExhausted;

/** The most jobs a list answers (the contract's `maxSlideshowsListed`). */
export const maxSlideshowsListed = 50;

/** The image formats the service composes: JPEG and PNG. */
const composedImages: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
]);

const decodeAssetId = Schema.decodeUnknownOption(MediaAssetIdSchema);

const decodeSlideshowId = Schema.decodeUnknownOption(SlideshowIdSchema);

const providerOf = (
  use: OpenedCompositionUse
): CompositionProviderId | null => {
  if (use._tag === "open") {
    return use.endpoint.provider;
  }

  return use._tag === "keyUnreadable" ? use.provider : null;
};

// A caption left blank shows none.
const captionOf = (caption: string | null): string | null => {
  const trimmed = caption?.trim() ?? "";

  return trimmed === "" ? null : trimmed;
};

type SlideshowPorts =
  | CapabilityModels
  | Ids
  | MeteredUsage
  | ProviderConnections
  | SlideshowJobs
  | SlideshowMedia
  | SlideshowNotices
  | SlideshowStore
  | TransactionRunner;

/**
 * Whether the workspace's billing account must add a payment method
 * first: only on a server that bills, where slide videos are for paying
 * customers.
 */
const needsPayment = (workspaceId: WorkspaceId) =>
  MeteredUsage.use((meters) => meters.paymentMethod(workspaceId)).pipe(
    Effect.map(Option.exists((paid) => !paid)),
    Effect.catchTag("DatabaseError", Effect.die)
  );

/**
 * Slide videos composed into a workspace's media library by the service
 * it chose for `composition`, with its own key, from its own images,
 * each a durable job (`RunSlideshow` runs it). Asking needs assistant:use
 * and media:upload, reading assistant:use; staff acting as a member ask
 * for none, as the workspace's account at the service pays. On a server
 * that bills, only an account with a payment method asks: nothing of
 * Peal's is metered or billed. Each workspace has one at a time and
 * `slideshowsPerDay` a UTC day, whatever each ends with.
 */
export class AssistantSlideshows extends Context.Service<
  AssistantSlideshows,
  {
    /**
     * Checks the request against the choice, the billing account, the
     * files and the plan's storage, then records the job and starts it,
     * in one transaction: queued, for its job to compose.
     */
    readonly request: (
      actor: Actor,
      asked: SlideshowAsked
    ) => Effect.Effect<Slideshow, RequestSlideshowFailure>;
    readonly view: (
      actor: Actor,
      id: string
    ) => Effect.Effect<Slideshow, MissingPermission | SlideshowNotFound>;
    /** The workspace's jobs, newest first, `maxSlideshowsListed` at most. */
    readonly list: (
      actor: Actor,
      status: Option.Option<SlideshowStatus>
    ) => Effect.Effect<readonly Slideshow[], MissingPermission>;
    readonly status: (
      actor: Actor
    ) => Effect.Effect<SlideshowsStatus, MissingPermission>;
  }
>()("peal-server/assistant/application/AssistantSlideshows") {
  static readonly layer = Layer.effect(
    AssistantSlideshows,
    Effect.gen(function* AssistantSlideshowsLive() {
      const ports = yield* Effect.context<SlideshowPorts>();

      const reading = <A, E>(
        actor: Actor,
        useCase: Effect.Effect<A, E, SlideshowPorts>
      ): Effect.Effect<A, E | MissingPermission> =>
        Effect.fromResult(authorize(actor, "assistant:use")).pipe(
          Effect.andThen(useCase),
          Effect.provideContext(ports)
        );

      // Each slide's image: a ready JPEG or PNG of the workspace.
      const imageOf = Effect.fn("AssistantSlideshows.imageOf")(
        function* imageOf(workspaceId: WorkspaceId, mediaId: string) {
          const id = decodeAssetId(mediaId);

          const found = Option.isSome(id)
            ? yield* SlideshowMedia.use((media) =>
                media.describe(workspaceId, id.value)
              )
            : Option.none();

          if (
            Option.isNone(id) ||
            Option.isNone(found) ||
            found.value.kind !== "image"
          ) {
            return yield* new SlideshowRejected({ reason: "imageNotFound" });
          }

          if (!composedImages.has(found.value.contentType)) {
            return yield* new SlideshowRejected({
              reason: "imageNotSupported",
            });
          }

          return id.value;
        }
      );

      // The voice-over: a ready audio file whose length is known.
      const voiceoverOf = Effect.fn("AssistantSlideshows.voiceoverOf")(
        function* voiceoverOf(workspaceId: WorkspaceId, mediaId: string) {
          const id = decodeAssetId(mediaId);

          const found = Option.isSome(id)
            ? yield* SlideshowMedia.use((media) =>
                media.describe(workspaceId, id.value)
              )
            : Option.none();

          const seconds = found.pipe(
            Option.filter(({ kind }) => kind === "audio"),
            Option.flatMap(({ durationSeconds }) => durationSeconds)
          );

          if (Option.isNone(id) || Option.isNone(seconds)) {
            return yield* new SlideshowRejected({
              reason: "voiceoverNotFound",
            });
          }

          return { id: id.value, seconds: seconds.value };
        }
      );

      const request = Effect.fn("AssistantSlideshows.request")(
        function* request(actor: Actor, asked: SlideshowAsked) {
          yield* Effect.fromResult(authorize(actor, "assistant:use"));
          yield* Effect.fromResult(authorize(actor, "media:upload"));

          // Staff acting as a member would spend the workspace's account at
          // its service: the member does it themselves.
          if (
            actor.subject._tag === "user" &&
            Option.isSome(actor.subject.impersonatedBy)
          ) {
            return yield* new MissingPermission({
              permission: "assistant:configure",
            });
          }

          const { workspaceId } = actor;
          const use = yield* openCompositionUse(workspaceId);

          if (use._tag !== "open") {
            return yield* new CompositionUnavailable({ reason: use._tag });
          }

          if (yield* needsPayment(workspaceId)) {
            return yield* new CompositionNeedsPayment();
          }

          // In order, the first image refused deciding the answer.
          const slides = yield* Effect.all(
            asked.slides.map((slide) =>
              imageOf(workspaceId, slide.mediaId).pipe(
                Effect.map((mediaId): PlannedSlide => ({
                  caption: captionOf(slide.caption),
                  mediaId,
                  motion: slide.motion,
                }))
              )
            )
          );

          const voiceover =
            asked.voiceoverMediaId === null
              ? null
              : yield* voiceoverOf(workspaceId, asked.voiceoverMediaId);

          const length = yield* Effect.fromResult(
            slideshowLengthOf({
              secondsPerSlide: asked.secondsPerSlide,
              slides: slides.length,
              voiceoverSeconds: voiceover?.seconds ?? null,
            })
          );

          // The largest video Peal keeps must fit before anything is asked.
          yield* SlideshowMedia.use((media) => media.roomFor(workspaceId));

          const now = yield* DateTime.now;
          const window = usageWindowAt(now);

          const slideshow = new Slideshow({
            aspect: asked.aspect,
            createdAt: now,
            durationSeconds: length.totalSeconds,
            finishedAt: Option.none(),
            id: yield* newId(SlideshowIdSchema),
            imageMediaIds: slides.map(({ mediaId }) => mediaId),
            mediaId: Option.none(),
            reason: Option.none(),
            requestedBy:
              actor.subject._tag === "user"
                ? Option.some(actor.subject.userId)
                : Option.none(),
            sandbox: use.sandbox,
            startedAt: Option.none(),
            status: "queued",
            voiceoverMediaId:
              voiceover === null ? Option.none() : Option.some(voiceover.id),
            workspaceId,
          });

          const plan: SlidePlan = {
            secondsPerSlide: length.secondsPerSlide,
            slides,
            transition: asked.transition,
          };

          const store = yield* SlideshowStore;
          const jobs = yield* SlideshowJobs;
          const notices = yield* SlideshowNotices;
          const { transaction } = yield* TransactionRunner;

          // The row and its job's start commit together, or not at all.
          const started = yield* transaction(
            Effect.gen(function* recording() {
              const outcome = yield* store.start(slideshow, plan, {
                dailyLimit: slideshowsPerDay,
                dayStart: DateTime.subtractDuration(window.resetsAt, "1 day"),
                now,
                staleBefore: DateTime.subtractDuration(
                  now,
                  staleSlideshowAfter
                ),
              });

              if (outcome._tag === "started") {
                yield* jobs.start(slideshow.id);
                yield* Effect.forEach(outcome.interrupted, notices.ended, {
                  discard: true,
                });
              }

              return outcome;
            })
          ).pipe(Effect.catchTag("DatabaseError", Effect.die));

          if (started._tag === "busy") {
            return yield* new CompositionBusy({
              slideshowId: started.slideshowId,
            });
          }

          if (started._tag === "exhausted") {
            return yield* new SlideshowsExhausted({
              dailyLimit: slideshowsPerDay,
              resetsAt: window.resetsAt,
            });
          }

          return slideshow;
        }
      );

      const view = (actor: Actor, id: string) =>
        reading(
          actor,
          Effect.gen(function* viewing() {
            const decoded = decodeSlideshowId(id);

            const found = Option.isSome(decoded)
              ? yield* SlideshowStore.use((store) =>
                  store.get(actor.workspaceId, decoded.value)
                )
              : Option.none<Slideshow>();

            return yield* Option.match(found, {
              onNone: () => Effect.fail(new SlideshowNotFound()),
              onSome: Effect.succeed,
            });
          })
        );

      const status = (actor: Actor) =>
        reading(
          actor,
          Effect.gen(function* slideshowStatus() {
            const window = usageWindowAt(yield* DateTime.now);
            const use = yield* openCompositionUse(actor.workspaceId);

            const used = yield* SlideshowStore.use((store) =>
              store.countSince(
                actor.workspaceId,
                DateTime.subtractDuration(window.resetsAt, "1 day")
              )
            );

            const slideshowsStatus: SlideshowsStatus = {
              available: use._tag === "open",
              dailyLimit: slideshowsPerDay,
              paymentMethodRequired:
                use._tag === "open" && (yield* needsPayment(actor.workspaceId)),
              provider: providerOf(use),
              remaining: remainingOf(slideshowsPerDay, used),
              sandbox: use._tag === "notSet" ? false : use.sandbox,
            };

            return slideshowsStatus;
          })
        );

      return AssistantSlideshows.of({
        list: (actor, wanted) =>
          reading(
            actor,
            SlideshowStore.use((store) =>
              store.list(actor.workspaceId, wanted, maxSlideshowsListed)
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
