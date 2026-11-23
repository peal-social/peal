import { Context } from "effect";
import type { Effect, Redacted } from "effect";

import type { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import type { CompositionProviderId } from "#assistant/domain/composition-provider.ts";
import type { ImageAspect } from "#assistant/domain/image-aspect.ts";
import type { ProviderAddress } from "#assistant/domain/image-provider.ts";
import type {
  SlideMotion,
  SlideTransition,
} from "#assistant/domain/slideshow.ts";

/** Where a workspace's composition service is, with its key. */
export interface OwnComposerEndpoint {
  readonly apiKey: Redacted.Redacted;
  readonly baseUrl: ProviderAddress;
  readonly provider: CompositionProviderId;
}

/** A slide as the service fetches it: its image's link, its caption. */
export interface ComposedSlide {
  readonly caption: string | null;
  readonly imageUrl: string;
  readonly motion: SlideMotion;
}

/** What to compose, every file given by a short-lived link. */
export interface CompositionRequest {
  readonly aspect: ImageAspect;
  readonly secondsPerSlide: number;
  readonly slides: readonly ComposedSlide[];
  readonly transition: SlideTransition;
  readonly voiceoverUrl: string | null;
}

/**
 * The composition service of a workspace, with its key: one render a
 * call, never sent again, waited for, and its video downloaded; failures
 * `SlideshowFailed` by reason alone.
 */
export class OwnComposer extends Context.Service<
  OwnComposer,
  {
    readonly compose: (
      endpoint: OwnComposerEndpoint,
      request: CompositionRequest
    ) => Effect.Effect<Uint8Array, SlideshowFailed>;
  }
>()("peal-server/assistant/application/OwnComposer") {}
