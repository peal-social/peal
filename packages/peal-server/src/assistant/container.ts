import { Layer } from "effect";

import { AgentModelAccess } from "#assistant/application/agent-model-access.ts";
import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { AssistantRequests } from "#assistant/application/assistant-requests.ts";
import { AssistantSlideshows } from "#assistant/application/assistant-slideshows.ts";
import { AssistantVideos } from "#assistant/application/assistant-videos.ts";
import { SlideshowSlots } from "#assistant/application/ports/slideshow-slots.ts";
import { VideoSlots } from "#assistant/application/ports/video-slots.ts";
import { RunSlideshow } from "#assistant/application/run-slideshow.ts";
import { RunVideoGeneration } from "#assistant/application/run-video-generation.ts";
import { WritingAssistant } from "#assistant/application/writing-assistant.ts";
import { CipherProviderSecrets } from "#assistant/infrastructure/cipher-provider-secrets.ts";
import { CountedImageSlots } from "#assistant/infrastructure/counted-image-slots.ts";
import { CountedTextSlots } from "#assistant/infrastructure/counted-text-slots.ts";
import { DrizzleAssistantUsageLive } from "#assistant/infrastructure/drizzle-assistant-usage.ts";
import { DrizzleImageProvidersLive } from "#assistant/infrastructure/drizzle-image-providers.ts";
import { DrizzleOwnAudioCountsLive } from "#assistant/infrastructure/drizzle-own-audio-counts.ts";
import { DrizzleOwnImageCountsLive } from "#assistant/infrastructure/drizzle-own-image-counts.ts";
import { DrizzleOwnTextCountsLive } from "#assistant/infrastructure/drizzle-own-text-counts.ts";
import {
  DrizzleCapabilityModelsLive,
  DrizzleProviderConnectionsLive,
} from "#assistant/infrastructure/drizzle-provider-connections.ts";
import { DrizzleSlideshowsLive } from "#assistant/infrastructure/drizzle-slideshows.ts";
import { DrizzleTextProvidersLive } from "#assistant/infrastructure/drizzle-text-providers.ts";
import { DrizzleUsageRecordsLive } from "#assistant/infrastructure/drizzle-usage-records.ts";
import { DrizzleVideoGenerationsLive } from "#assistant/infrastructure/drizzle-video-generations.ts";
import { GuardedProviderAddressCheck } from "#assistant/infrastructure/guarded-provider-address-check.ts";
import { ImageModelLive } from "#assistant/infrastructure/image-model-live.ts";
import { LibraryAudioLive } from "#assistant/infrastructure/library-audio.ts";
import { LibraryGeneratedImagesLive } from "#assistant/infrastructure/library-generated-images.ts";
import { LibraryGeneratedVideosLive } from "#assistant/infrastructure/library-generated-videos.ts";
import { LibrarySlideshowMediaLive } from "#assistant/infrastructure/library-slideshow-media.ts";
import { MoveEarlierProvidersLive } from "#assistant/infrastructure/move-earlier-providers.ts";
import { NotifiedSlideshowNoticesLive } from "#assistant/infrastructure/notified-slideshow-notices.ts";
import { NotifiedVideoNoticesLive } from "#assistant/infrastructure/notified-video-notices.ts";
import { OwnAudioModelLive } from "#assistant/infrastructure/own-audio-model.ts";
import { OwnComposerLive } from "#assistant/infrastructure/own-composer.ts";
import { OwnImageModelLive } from "#assistant/infrastructure/own-image-model.ts";
import { OwnVideoModelLive } from "#assistant/infrastructure/own-video-model.ts";
import { OwnWritingModelLive } from "#assistant/infrastructure/own-writing-model.ts";
import { PlanAssistantAllowanceLive } from "#assistant/infrastructure/plan-assistant-allowance.ts";
import { PublishingPlatformLimitsLive } from "#assistant/infrastructure/publishing-platform-limits.ts";
import { ShotstackEditCheckerLive } from "#assistant/infrastructure/shotstack/edit-checker.ts";
import {
  ComposeSlideshowV1Live,
  WorkflowSlideshowJobs,
} from "#assistant/infrastructure/workflows/compose-slideshow.ts";
import {
  GenerateVideoV1Live,
  WorkflowVideoJobs,
} from "#assistant/infrastructure/workflows/generate-video.ts";
import { WritingModelLive } from "#assistant/infrastructure/writing-model-live.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";

export { WritingAssistant } from "#assistant/application/writing-assistant.ts";

/**
 * The workspaces' connected providers and their choice for each use, and
 * the text and image providers the deprecated endpoints read on them.
 * Needs `Drizzle`, `SqlClient` and `ProviderSecrets`.
 */
export const ProviderStoresLive = Layer.mergeAll(
  DrizzleImageProvidersLive,
  DrizzleTextProvidersLive
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(DrizzleProviderConnectionsLive, DrizzleCapabilityModelsLive)
  )
);

// The assistant endpoints. They need the use cases AssistantLive provides,
// and the Authentication and WorkspaceAccess middleware of the workspace
// context, which the composition root brings.
export { AssistantHandlers as AssistantApiLive } from "#assistant/api/assistant.ts";

// The video jobs' endpoints, beside the assistant's.
export { VideoGenerationsHandlers as VideoGenerationsApiLive } from "#assistant/api/video-generations.ts";

// The images', voice-overs' and transcripts' endpoints, beside the media's.
export { MediaImagesHandlers as MediaImagesApiLive } from "#assistant/api/images.ts";

export { MediaAudioHandlers as MediaAudioApiLive } from "#assistant/api/media-audio.ts";

export { MediaTranscriptionsHandlers as MediaTranscriptionsApiLive } from "#assistant/api/transcriptions.ts";

// The slide videos' endpoints, beside the media's.
export { SlideshowsHandlers as SlideshowsApiLive } from "#assistant/api/slideshows.ts";

/**
 * The assistant's durable jobs: one workflow a video, one a slide video.
 * Needs AssistantLive's RunVideoGeneration and RunSlideshow, and the
 * cluster's engine.
 */
export const AssistantWorkersLive = Layer.mergeAll(
  GenerateVideoV1Live,
  ComposeSlideshowV1Live
);

/**
 * The writing assistant: its use cases on the language model and the image
 * model the environment names (or none, which turns each off), the daily
 * quota in Postgres, as large as the workspace's plan allows, the
 * platforms' limits from publishing, and the media library, which keeps
 * the images it makes; the image and text providers each workspace may
 * bring, their keys sealed on the channels context's `TokenCipher`, called
 * through the outbound guard; the day's count, for billing; the model's
 * access for the agent (AgentModelAccess), with the same slots and counts;
 * and UsageRecords, for the
 * workspace context's exports and erasures. The composition root provides
 * `Drizzle`, the billing context's `WorkspaceEntitlements`, the media
 * context's `MediaLibrary`, the `TokenCipher` and the runtime's Dns (the
 * outbound guard checks the addresses a workspace types and those an image
 * provider answers with).
 */
export const AssistantLive = Layer.mergeAll(
  Layer.mergeAll(
    WritingAssistant.layer,
    AssistantRequests.layer,
    AgentModelAccess.layer,
    AssistantVideos.layer,
    RunVideoGeneration.layer,
    AssistantAudio.layer,
    AssistantSlideshows.layer,
    RunSlideshow.layer
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        WritingModelLive,
        ImageModelLive,
        OwnImageModelLive,
        DrizzleOwnImageCountsLive,
        OwnWritingModelLive,
        DrizzleOwnTextCountsLive,
        // The earlier rows moved once, before anything reads.
        ProviderStoresLive.pipe(
          Layer.provideMerge(MoveEarlierProvidersLive),
          Layer.provide(CipherProviderSecrets)
        ),
        GuardedProviderAddressCheck.pipe(Layer.provide(OutboundGuard.layer)),
        CountedImageSlots,
        CountedTextSlots,
        LibraryGeneratedImagesLive,
        DrizzleAssistantUsageLive,
        PlanAssistantAllowanceLive,
        PublishingPlatformLimitsLive,
        DrizzleVideoGenerationsLive,
        WorkflowVideoJobs,
        NotifiedVideoNoticesLive,
        LibraryGeneratedVideosLive,
        OwnVideoModelLive,
        VideoSlots.layer,
        LibraryAudioLive,
        OwnAudioModelLive,
        DrizzleOwnAudioCountsLive,
        DrizzleSlideshowsLive,
        WorkflowSlideshowJobs,
        NotifiedSlideshowNoticesLive,
        LibrarySlideshowMediaLive,
        OwnComposerLive,
        ShotstackEditCheckerLive,
        SlideshowSlots.layer
      )
    )
  ),
  DrizzleUsageRecordsLive
);
