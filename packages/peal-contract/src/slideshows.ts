import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { ImageAspectSchema } from "./assistant.ts";
import { Authentication } from "./authentication.ts";
import { CompositionAllowanceReached } from "./composition-allowance-reached.ts";
import { CompositionBusy } from "./composition-busy.ts";
import { CompositionNeedsPayment } from "./composition-needs-payment.ts";
import { CompositionUnavailable } from "./composition-unavailable.ts";
import { Forbidden } from "./forbidden.ts";
import { PlanLimitReached } from "./plan-limit-reached.ts";
import { SlideshowNotFound } from "./slideshow-not-found.ts";
import { SlideshowRequestRejected } from "./slideshow-request-rejected.ts";
import { WorkspaceAccess } from "./workspace-access.ts";

/**
 * What a slide video holds: 2 to 10 images, a caption of at most 120
 * characters each, 2 to 10 seconds a slide (4 when neither the request nor
 * a voice-over says), 90 seconds in all, and how many a workspace may ask
 * for each UTC day. The server's values
 * (src/assistant/domain/slideshow-limits.ts) are the source.
 */
export const minSlides = 2;

export const maxSlides = 10;

export const maxSlideCaptionLength = 120;

export const minSecondsPerSlide = 2;

export const maxSecondsPerSlide = 10;

export const defaultSecondsPerSlide = 4;

export const maxSlideshowSeconds = 90;

export const slideshowsPerDay = 20;

/** The most slide videos a list answers. */
export const maxSlideshowsListed = 50;

/**
 * How a slide moves while it shows: `none`, still; `zoomIn` and `zoomOut`,
 * a slow zoom; `slide`, a slow pan. New motions join the end of the list.
 */
export const SlideMotionSchema = Schema.Literals([
  "none",
  "zoomIn",
  "zoomOut",
  "slide",
]).annotate({ identifier: "SlideMotion" });

export type SlideMotion = typeof SlideMotionSchema.Type;

/**
 * How one slide gives way to the next: `none`, a cut; `fade`, a fade.
 * New transitions join the end of the list.
 */
export const SlideTransitionSchema = Schema.Literals(["none", "fade"]).annotate(
  { identifier: "SlideTransition" }
);

export type SlideTransition = typeof SlideTransitionSchema.Type;

export const SlideSchema = Schema.Struct({
  // A line shown over the bottom of the slide, white on a dark band, as
  // plain text. Left out or blank, none.
  caption: Schema.optionalKey(
    Schema.String.check(Schema.isMaxLength(maxSlideCaptionLength))
  ),
  // A ready JPEG or PNG image of the workspace's library.
  mediaId: Schema.String,
  // Left out, `none`.
  motion: Schema.optionalKey(SlideMotionSchema),
}).annotate({ identifier: "Slide" });

export type Slide = typeof SlideSchema.Type;

export const SlideshowRequestSchema = Schema.Struct({
  aspect: ImageAspectSchema,
  // How long each slide shows, in whole seconds. Left out, fitted to the
  // voice-over's length when there is one, else `defaultSecondsPerSlide`.
  secondsPerSlide: Schema.optionalKey(
    Schema.Int.check(
      Schema.isBetween({
        maximum: maxSecondsPerSlide,
        minimum: minSecondsPerSlide,
      })
    )
  ),
  // The slides, in the order they show.
  slides: Schema.Array(SlideSchema).check(
    Schema.isMinLength(minSlides),
    Schema.isMaxLength(maxSlides)
  ),
  // Left out, `fade`.
  transition: Schema.optionalKey(SlideTransitionSchema),
  // A ready audio file of the workspace's library that plays from the
  // first slide, cut at the last one's end.
  voiceoverMediaId: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "SlideshowRequest" });

export type SlideshowRequest = typeof SlideshowRequestSchema.Type;

/**
 * Where a slide video stands: `queued`, waiting its turn; `running`, the
 * service is composing it; `succeeded`, it is a file of the media library
 * (`mediaId`); `failed`, nothing was kept (`reason`).
 */
export const SlideshowStatusSchema = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
]).annotate({ identifier: "SlideshowStatus" });

export type SlideshowStatus = typeof SlideshowStatusSchema.Type;

/**
 * Why a slide video failed:
 *
 * - `unavailable`: no service is chosen for slide videos any more.
 * - `keyUnreadable`: the service's key can no longer be read.
 * - `settingsRefused`: the service refused the key or the account (401,
 *   402, 403, 404), as when it has no credits left.
 * - `addressRefused`: the service's address is not one Peal sends to.
 * - `redirected`: the service answered with a redirect, never followed.
 * - `unreachable`: the service could not be reached, or was busy (429,
 *   5xx).
 * - `refused`: the service refused this request, or failed to render it.
 * - `timedOut`: the video took longer than Peal waits.
 * - `unusableAnswer`: the service's answer held no video the library
 *   takes, or one too large.
 * - `mediaUnavailable`: an image or the voice-over was deleted, or could
 *   not be handed to the service.
 * - `storageFull`: the plan's media storage had no room for it.
 * - `notStored`: the media store failed to keep it.
 * - `interrupted`: the server stopped while it was composed; it is never
 *   asked for again, as the service may have rendered and billed it.
 *
 * New reasons join the end of the list.
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
]).annotate({ identifier: "SlideshowFailureReason" });

export type SlideshowFailureReason = typeof SlideshowFailureReasonSchema.Type;

/** A slide video the workspace asked for, and where it stands. */
export const SlideshowSchema = Schema.Struct({
  aspect: ImageAspectSchema,
  createdAt: Schema.DateTimeUtc,
  // How long it lasts, in seconds: the slides' length in all.
  durationSeconds: Schema.Number,
  // When it ended, once `succeeded` or `failed`.
  finishedAt: Schema.NullOr(Schema.DateTimeUtc),
  id: Schema.String,
  // The slides' images, in the order they show.
  imageMediaIds: Schema.Array(Schema.String),
  // The video in the media library, once `succeeded`.
  mediaId: Schema.NullOr(Schema.String),
  // Why it failed, once `failed`.
  reason: Schema.NullOr(SlideshowFailureReasonSchema),
  // Whether the service's sandbox composed it, which watermarks every
  // video.
  sandbox: Schema.Boolean,
  // When the service was asked, once `running`.
  startedAt: Schema.NullOr(Schema.DateTimeUtc),
  status: SlideshowStatusSchema,
  // The voice-over it plays, if any.
  voiceoverMediaId: Schema.NullOr(Schema.String),
}).annotate({ identifier: "Slideshow" });

export type Slideshow = typeof SlideshowSchema.Type;

export const SlideshowsSchema = Schema.Struct({
  slideshows: Schema.Array(SlideshowSchema),
}).annotate({ identifier: "Slideshows" });

export type Slideshows = typeof SlideshowsSchema.Type;

const workspace = { workspaceId: Schema.String };

/**
 * Slide videos composed for the workspace's media library from its own
 * images, captions and voice-over, by the service it chose for
 * `composition` (Shotstack), with its own key: a durable job each, which
 * a request starts and the workspace follows.
 */
export class SlideshowsApi extends HttpApiGroup.make("slideshows")
  .add(
    HttpApiEndpoint.post("create", "/", {
      error: [
        Forbidden,
        CompositionUnavailable,
        CompositionNeedsPayment,
        SlideshowRequestRejected,
        CompositionBusy,
        CompositionAllowanceReached,
        PlanLimitReached,
      ],
      params: workspace,
      payload: SlideshowRequestSchema,
      success: SlideshowSchema.pipe(HttpApiSchema.status(202)),
    }).annotateMerge(
      OpenApi.annotations({
        description: `Asks the service the workspace chose for slide videos (\`PUT .../assistant/models/composition\`, Shotstack) to compose ${minSlides} to ${maxSlides} images of its library, in order, each with an optional caption and motion, optionally over a voice-over of its library, in the aspect asked, and answers 202 with the job, \`queued\`. Each slide lasts \`secondsPerSlide\`, or the voice-over's length shared between them, ${maxSlideshowSeconds} seconds at most in all. Follow it with \`GET .../media/slideshows/{id}\`; once \`succeeded\`, the video is a file of the media library (\`mediaId\`, MP4 at 1080p), not marked \`aiGenerated\`, and the member who asked is told in the app. The service receives each file through a link that works for an hour, and renders with the workspace's own key, under its terms and at its prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free and watermarks every video. On a server that bills, it needs a payment method on the workspace's billing account (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), ${slideshowsPerDay} a UTC day (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed fails it (\`interrupted\`). Neither the captions nor the video are logged, and the captions are kept only while the video is composed. Needs assistant:use and media:upload.`,
        summary: "Compose a slide video into the media library",
      })
    ),
    HttpApiEndpoint.get("list", "/", {
      error: Forbidden,
      params: workspace,
      query: { status: Schema.optionalKey(SlideshowStatusSchema) },
      success: SlideshowsSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Lists the slide videos the workspace asked for, newest first, ${maxSlideshowsListed} at most, only those with \`status\` when given. Needs assistant:use.`,
        summary: "List slide video jobs",
      })
    ),
    HttpApiEndpoint.get("get", "/:slideshowId", {
      error: [Forbidden, SlideshowNotFound],
      params: { slideshowId: Schema.String, workspaceId: Schema.String },
      success: SlideshowSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why (`reason`). Needs assistant:use.",
        summary: "Get a slide video job",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/workspaces/:workspaceId/media/slideshows") {}
