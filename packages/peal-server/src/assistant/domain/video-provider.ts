import { Result, Schema } from "effect";

import type { ImageAspect } from "./image-aspect.ts";
import { VideoRejected } from "./video-rejected.ts";

/**
 * The providers Peal makes videos with (`aiVideoProviders` in
 * `peal-contract/ai-providers`, kept equal by
 * `test/assistant/api/contract.test.ts`), each with an adapter of its own.
 */
export const VideoProviderIdSchema = Schema.Literals(["google", "xai"]);

export type VideoProviderId = typeof VideoProviderIdSchema.Type;

/** A video's ratio of width to height, as the providers take it. */
export type VideoRatio = `${number}:${number}`;

/** What a provider makes, as the catalogue says. */
export interface VideoOffer {
  /** The ratio asked for each aspect, or null for one it does not make. */
  readonly aspects: Readonly<Record<ImageAspect, VideoRatio | null>>;
  /** Where its video API is reached when no address is given. */
  readonly baseUrl: string;
  /** The lengths it takes, in whole seconds; null when it takes none. */
  readonly durations: { readonly max: number; readonly min: number } | null;
  /** Whether a picture may be its first frame. */
  readonly imageInput: boolean;
}

/** Each provider's offer, as the contract's catalogue states it. */
export const videoOffers: Readonly<Record<VideoProviderId, VideoOffer>> = {
  google: {
    aspects: { landscape: "16:9", portrait: "9:16", square: null },
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    durations: null,
    imageInput: true,
  },
  xai: {
    aspects: { landscape: "16:9", portrait: "9:16", square: "1:1" },
    baseUrl: "https://api.x.ai/v1",
    durations: { max: 15, min: 1 },
    imageInput: true,
  },
};

/** What a member asks of the provider, before it is checked against it. */
export interface VideoAsk {
  readonly aspect: ImageAspect;
  readonly durationSeconds: number | null;
  readonly withImage: boolean;
}

/**
 * The ratio the provider is asked for, once the request fits what it
 * makes: an aspect it makes, a length within the ones it takes (none for
 * a provider that takes none), a first frame only where it takes one.
 */
export const checkVideoAsk = (
  provider: VideoProviderId,
  { aspect, durationSeconds, withImage }: VideoAsk
): Result.Result<VideoRatio, VideoRejected> => {
  const offer = videoOffers[provider];
  const ratio = offer.aspects[aspect];

  if (ratio === null) {
    return Result.fail(new VideoRejected({ reason: "aspectNotOffered" }));
  }

  if (
    durationSeconds !== null &&
    (offer.durations === null ||
      durationSeconds < offer.durations.min ||
      durationSeconds > offer.durations.max)
  ) {
    return Result.fail(new VideoRejected({ reason: "durationNotOffered" }));
  }

  return withImage && !offer.imageInput
    ? Result.fail(new VideoRejected({ reason: "imageNotOffered" }))
    : Result.succeed(ratio);
};
