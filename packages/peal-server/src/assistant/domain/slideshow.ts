import { Schema } from "effect";

import {
  MediaAssetIdSchema,
  UserIdSchema,
  Uuid7Schema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";

import { ImageAspectSchema } from "./image-aspect.ts";
import { maxSlideCaptionLength } from "./slideshow-limits.ts";

/** A slide video a workspace asked for: a lowercase UUIDv7. */
export const SlideshowIdSchema = Uuid7Schema.pipe(Schema.brand("SlideshowId"));

export type SlideshowId = typeof SlideshowIdSchema.Type;

/**
 * Where a slide video stands. Stored as text: add states, never rename
 * one.
 */
export const SlideshowStatusSchema = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export type SlideshowStatus = typeof SlideshowStatusSchema.Type;

/**
 * Why a slide video failed (the contract's `SlideshowFailureReason`, kept
 * equal by `test/assistant/api/contract.test.ts`). Stored as text: add
 * reasons, never rename one.
 */
export const SlideshowFailureReasonSchema = Schema.Literals([
  "unavailable",
  "keyUnreadable",
  "settingsRefused",
  "addressRefused",
  "redirected",
  "unreachable",
  "refused",
  "timedOut",
  "unusableAnswer",
  "mediaUnavailable",
  "storageFull",
  "notStored",
  "interrupted",
]);

export type SlideshowFailureReason = typeof SlideshowFailureReasonSchema.Type;

/** How a slide moves (the contract's `SlideMotion`). */
export const SlideMotionSchema = Schema.Literals([
  "none",
  "zoomIn",
  "zoomOut",
  "slide",
]);

export type SlideMotion = typeof SlideMotionSchema.Type;

/** How a slide gives way to the next (the contract's `SlideTransition`). */
export const SlideTransitionSchema = Schema.Literals(["none", "fade"]);

export type SlideTransition = typeof SlideTransitionSchema.Type;

/** A caption as shown: a line of text, not blank, of a bounded length. */
export const SlideCaptionSchema = Schema.String.check(
  Schema.isMaxLength(maxSlideCaptionLength),
  Schema.makeFilter((text: string) => text.trim() !== "", {
    expected: "a text that is not blank",
  })
);

/** One slide of a plan: its image, its caption if any, how it moves. */
export const PlannedSlideSchema = Schema.Struct({
  caption: Schema.NullOr(SlideCaptionSchema),
  mediaId: MediaAssetIdSchema,
  motion: SlideMotionSchema,
});

export type PlannedSlide = typeof PlannedSlideSchema.Type;

/**
 * What a job composes, kept beside it only while it is on its way, as
 * the captions are the member's words: the slides in order, how long each
 * shows and how they give way to each other. Stored as JSON: add keys
 * with a default, never rename one.
 */
export const SlidePlanSchema = Schema.Struct({
  secondsPerSlide: Schema.Number,
  slides: Schema.Array(PlannedSlideSchema),
  transition: SlideTransitionSchema,
});

export type SlidePlan = typeof SlidePlanSchema.Type;

/**
 * What a job renders when a whole Shotstack Edit was asked for: the edit
 * as checked (`edit-render.ts`), its library files still named
 * `peal:media/<mediaId>`, swapped for short-lived links only when the job
 * sends it. Kept beside the job only while it is on its way, as its text
 * is the member's words.
 */
export const EditPlanSchema = Schema.Struct({ edit: Schema.JsonObject });

export type EditPlan = typeof EditPlanSchema.Type;

/**
 * A job's plan, as stored: a slide plan (its keys as the release before
 * wrote them, no tag) or an edit plan. Decoded in this order, so a row
 * an earlier release wrote reads as it did.
 */
export const SlideshowPlanSchema = Schema.Union([
  SlidePlanSchema,
  EditPlanSchema,
]);

export type SlideshowPlan = typeof SlideshowPlanSchema.Type;

/**
 * A slide video a workspace asked for, without its plan, which is kept
 * apart only while it is composed.
 */
export class Slideshow extends Schema.Class<Slideshow>(
  "peal-server/assistant/domain/Slideshow"
)({
  aspect: ImageAspectSchema,
  createdAt: Schema.DateTimeUtc,
  /** The slides' length in all, in seconds. */
  durationSeconds: Schema.Number,
  finishedAt: Schema.Option(Schema.DateTimeUtc),
  id: SlideshowIdSchema,
  /** The slides' images, in order. */
  imageMediaIds: Schema.Array(MediaAssetIdSchema),
  mediaId: Schema.Option(MediaAssetIdSchema),
  reason: Schema.Option(SlideshowFailureReasonSchema),
  /** The member who asked, when a member did (not a key). */
  requestedBy: Schema.Option(UserIdSchema),
  /** Whether the service's sandbox composes it, which watermarks it. */
  sandbox: Schema.Boolean,
  startedAt: Schema.Option(Schema.DateTimeUtc),
  status: SlideshowStatusSchema,
  voiceoverMediaId: Schema.Option(MediaAssetIdSchema),
  workspaceId: WorkspaceIdSchema,
}) {}
