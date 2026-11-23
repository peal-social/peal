import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { VideoFailed } from "#assistant/application/video-failed.ts";
import type { ProviderAddress } from "#assistant/domain/image-provider.ts";
import type {
  VideoProviderId,
  VideoRatio,
} from "#assistant/domain/video-provider.ts";

/** Where a workspace's video provider is, with its key and model. */
export interface OwnVideoEndpoint {
  readonly apiKey: Redacted.Redacted;
  readonly baseUrl: ProviderAddress;
  readonly model: string;
  readonly provider: VideoProviderId;
}

/** A picture to start the video from, as the library keeps it. */
export interface FirstFrame {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
}

/** What to make: the description, the ratio, the length and a first frame. */
export interface VideoRequest {
  readonly durationSeconds: number | null;
  readonly image: Option.Option<FirstFrame>;
  readonly prompt: string;
  readonly ratio: VideoRatio;
}

/**
 * The video model of a workspace's own provider, with its key: one video
 * a call, never asked again, its failures `VideoFailed` by reason alone.
 */
export class OwnVideoModel extends Context.Service<
  OwnVideoModel,
  {
    readonly generate: (
      endpoint: OwnVideoEndpoint,
      request: VideoRequest
    ) => Effect.Effect<Uint8Array, VideoFailed>;
  }
>()("peal-server/assistant/application/OwnVideoModel") {}
