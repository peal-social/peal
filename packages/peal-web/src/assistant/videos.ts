import { Match } from "effect";
import type {
  AssistantInputRejected,
  AssistantVideosStatus,
  Forbidden,
  ImageAspect,
  PlanLimitReached,
  TooManyRequests,
  Unauthenticated,
  VideoAllowanceReached,
  VideoBusy,
  VideoGeneration,
  VideoGenerationRequest,
  VideoRequestRejected,
  VideoUnavailable,
  WorkspaceNotFound,
} from "peal-contract";
import { aiProviders } from "peal-contract/ai-providers";
import type { AiVideoOffer } from "peal-contract/ai-providers";

// What the video dialog offers, from the provider the workspace chose for
// videos and what the catalogue says it takes, and how a refusal reads.

/** The aspects a video is offered in, in the order the dialog lists them. */
const aspectOrder: readonly ImageAspect[] = ["landscape", "portrait", "square"];

/** What the chosen provider makes videos with, or null when none is chosen. */
export const videoOfferOf = (
  videos: Pick<AssistantVideosStatus, "provider">
): AiVideoOffer | null =>
  videos.provider === null ? null : aiProviders[videos.provider].video;

/** The aspects the provider makes, those it has a ratio for. */
export const videoAspectsOf = (offer: AiVideoOffer): readonly ImageAspect[] =>
  aspectOrder.filter((aspect) => offer.aspects[aspect] !== null);

/**
 * The lengths the provider takes, in whole seconds, shortest first; none
 * when it picks the length itself, and the dialog then asks for none.
 */
export const videoDurationsOf = (offer: AiVideoOffer): readonly number[] =>
  offer.durations === null
    ? []
    : Array.from(
        { length: offer.durations.max - offer.durations.min + 1 },
        (_, index) => (offer.durations?.min ?? 0) + index
      );

/** What the dialog chose: a length and a first frame only when chosen. */
export interface VideoChoice {
  readonly aspect: ImageAspect;
  readonly durationSeconds: number | null;
  readonly imageMediaId: string | null;
  readonly prompt: string;
}

/** The request the dialog sends: what was not chosen is left out. */
export const videoRequestOf = ({
  aspect,
  durationSeconds,
  imageMediaId,
  prompt,
}: VideoChoice): VideoGenerationRequest => {
  const length = durationSeconds === null ? null : { durationSeconds };
  const frame = imageMediaId === null ? null : { imageMediaId };

  if (length !== null && frame !== null) {
    return { aspect, prompt, ...length, ...frame };
  }

  if (length !== null) {
    return { aspect, prompt, ...length };
  }

  return frame === null ? { aspect, prompt } : { aspect, prompt, ...frame };
};

/** Whether a job is still on its way: queued or being made. */
export const isOnTheWay = (job: Pick<VideoGeneration, "status">): boolean =>
  job.status === "queued" || job.status === "running";

/** The jobs still on the way, newest first as the list answers them. */
export const onTheWay = (
  jobs: readonly VideoGeneration[]
): readonly VideoGeneration[] => jobs.filter(isOnTheWay);

/**
 * The jobs that were on their way (`before`, their ids) and have ended in
 * the latest list: what the library tells the member about, once each.
 */
export const endedSince = (
  before: ReadonlySet<string>,
  jobs: readonly VideoGeneration[]
): readonly VideoGeneration[] =>
  jobs.filter((job) => before.has(job.id) && !isOnTheWay(job));

/** Why a video was not asked for, as the API declares it. */
export type VideoFailure =
  | AssistantInputRejected
  | Forbidden
  | PlanLimitReached
  | TooManyRequests
  | Unauthenticated
  | VideoAllowanceReached
  | VideoBusy
  | VideoRequestRejected
  | VideoUnavailable
  | WorkspaceNotFound
  // The request failed in a way the API does not declare.
  | { readonly _tag: "Unexpected" };

/** The message of `Assistant.videos.errors` that says why. */
export type VideoFailureKey =
  | "allowance"
  | "aspectNotOffered"
  | "busy"
  | "durationNotOffered"
  | "empty"
  | "forbidden"
  | "generic"
  | "imageNotFound"
  | "imageNotOffered"
  | "keyUnreadable"
  | "storage"
  | "tooLong"
  | "unavailable";

/** Which message tells the member why no video was asked for. */
export const videoFailureKey = (failure: VideoFailure): VideoFailureKey =>
  Match.valueTags(failure, {
    AssistantInputRejected: ({ reason }): VideoFailureKey => reason,
    Forbidden: (): VideoFailureKey => "forbidden",
    PlanLimitReached: (): VideoFailureKey => "storage",
    TooManyRequests: (): VideoFailureKey => "generic",
    Unauthenticated: (): VideoFailureKey => "generic",
    Unexpected: (): VideoFailureKey => "generic",
    VideoAllowanceReached: (): VideoFailureKey => "allowance",
    VideoBusy: (): VideoFailureKey => "busy",
    VideoRequestRejected: ({ reason }): VideoFailureKey => reason,
    VideoUnavailable: ({ reason }): VideoFailureKey =>
      reason === "notSet" ? "unavailable" : "keyUnreadable",
    WorkspaceNotFound: (): VideoFailureKey => "generic",
  });

/** Whether the refusal is the provider's settings, to fix in the assistant settings. */
export const isVideoSettingsRefusal = (failure: VideoFailure): boolean =>
  failure._tag === "VideoUnavailable";
