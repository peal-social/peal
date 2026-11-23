import { describe, expect, it } from "@effect/vitest";
import {
  anthropicApiAddress,
  AssistantActionSchema as ContractActionSchema,
  AudioFailureReasonSchema,
  maxTranscriptionBytes as contractTranscriptionBytes,
  maxVoiceoverTextLength as contractVoiceoverTextLength,
  transcriptionsPerDay as contractTranscriptionsPerDay,
  voiceoversPerDay as contractVoiceoversPerDay,
  AssistantToneSchema,
  ImageAspectSchema as ContractAspectSchema,
  imageProviderKeyPattern,
  imageProviderModelPattern,
  imageRequestCost as contractImageCost,
  maxImageProviderAddressLength,
  maxImageProviderKeyLength,
  maxImageProviderModelLength,
  maxImagePromptLength as contractPromptLength,
  ownTextRequestsPerDay as contractOwnTextRequests,
  TextProviderKindSchema as ContractTextKindSchema,
  TranslationLanguageSchema,
  maxVideoPromptLength,
  VideoFailureReasonSchema,
  videosPerDay as contractVideosPerDay,
  defaultSecondsPerSlide as contractDefaultSeconds,
  maxSecondsPerSlide as contractMaxSeconds,
  maxSlideCaptionLength as contractCaptionLength,
  maxSlides as contractMaxSlides,
  maxSlideshowSeconds as contractMaxSlideshowSeconds,
  maxSlideshowsListed as contractSlideshowsListed,
  minSecondsPerSlide as contractMinSeconds,
  minSlides as contractMinSlides,
  SlideMotionSchema as ContractMotionSchema,
  SlideshowFailureReasonSchema,
  SlideshowRejectionSchema,
  SlideshowStatusSchema as ContractSlideshowStatusSchema,
  slideshowsPerDay as contractSlideshowsPerDay,
  SlideTransitionSchema as ContractTransitionSchema,
} from "peal-contract";
import {
  aiCapabilityAddress,
  AiCapabilitySchema as ContractCapabilitySchema,
  AiImageProviderIdSchema,
  aiImageProviders,
  AiProviderIdSchema,
  aiProviderKind,
  aiProviderOfKind,
  aiProviderOffers,
  aiProviders,
  AiSpeechProviderIdSchema,
  aiSpeechProviders,
  AiTranscriptionProviderIdSchema,
  aiTranscriptionProviders,
  AiVideoProviderIdSchema,
  aiVideoProviders,
  AiCompositionProviderIdSchema,
  aiCompositionProviders,
  aiFixedAddresses,
} from "peal-contract/ai-providers";

import { maxSlideshowsListed } from "#assistant/application/assistant-slideshows.ts";
import {
  AiCapabilitySchema,
  capabilityAddressOf,
  ConnectedProviderIdSchema,
  connectionAddresses,
  firstTextModels,
  fixedAddressesOf,
  fixedAddressProviders,
  offersCapability,
} from "#assistant/domain/ai-capability.ts";
import { AssistantActionSchema } from "#assistant/domain/assistant-action.ts";
import {
  maxTranscriptionBytes,
  maxVoiceoverTextLength,
  transcriptionsPerDay,
  voiceoversPerDay,
} from "#assistant/domain/audio-limits.ts";
import {
  speechOffers,
  SpeechProviderIdSchema,
  transcriptionAddresses,
  TranscriptionProviderIdSchema,
} from "#assistant/domain/audio-provider.ts";
import { AudioFailureReasonSchema as ServerAudioFailureReasonSchema } from "#assistant/domain/audio-use.ts";
import {
  compositionOffers,
  CompositionProviderIdSchema,
} from "#assistant/domain/composition-provider.ts";
import { ImageAspectSchema } from "#assistant/domain/image-aspect.ts";
import { imageRequestCost } from "#assistant/domain/image-limits.ts";
import { maxImagePromptLength } from "#assistant/domain/image-prompt.ts";
import {
  imageProviderAddresses,
  ImageProviderIdSchema,
  imageDimensionsOf,
  maxProviderAddressLength,
  maxProviderKeyLength,
  maxProviderModelLength,
  providerKeyPattern,
  providerModelPattern,
} from "#assistant/domain/image-provider.ts";
import {
  defaultSecondsPerSlide,
  maxSecondsPerSlide,
  maxSlideCaptionLength,
  maxSlides,
  maxSlideshowSeconds,
  minSecondsPerSlide,
  minSlides,
  slideshowsPerDay,
} from "#assistant/domain/slideshow-limits.ts";
import { SlideshowRejected } from "#assistant/domain/slideshow-rejected.ts";
import {
  SlideMotionSchema,
  SlideshowFailureReasonSchema as ServerSlideshowReasonSchema,
  SlideshowStatusSchema,
  SlideTransitionSchema,
} from "#assistant/domain/slideshow.ts";
import {
  anthropicAddress,
  kindOfProvider,
  ownTextRequestsPerDay,
  providerAddresses,
  providerOfKind,
  TextProviderIdSchema,
  TextProviderKindSchema,
} from "#assistant/domain/text-provider.ts";
import { ToneSchema } from "#assistant/domain/tone.ts";
import { TranslationLanguageSchema as DomainLanguageSchema } from "#assistant/domain/translation-language.ts";
import { VideoFailureReasonSchema as ServerVideoFailureReasonSchema } from "#assistant/domain/video-generation.ts";
import {
  maxVideoPromptLength as serverVideoPromptLength,
  videosPerDay,
} from "#assistant/domain/video-limits.ts";
import {
  videoOffers,
  VideoProviderIdSchema,
} from "#assistant/domain/video-provider.ts";
import {
  SlideshowNoticeReasonSchema,
  VideoNoticeReasonSchema,
} from "#notifications/domain/notice-event.ts";

// Each action's tag with the names of its fields.
const fieldsByAction = (
  schema: typeof AssistantActionSchema | typeof ContractActionSchema
) =>
  schema.members.map((member) => [
    member.fields._tag.ast.literal,
    Object.keys(member.fields).toSorted(),
  ]);

describe("the contract", () => {
  it("lists the tones and languages the assistant knows", () => {
    expect(AssistantToneSchema.literals).toStrictEqual(ToneSchema.literals);
    expect(TranslationLanguageSchema.literals).toStrictEqual(
      DomainLanguageSchema.literals
    );
  });

  it("lists the actions the assistant takes, with their fields", () => {
    expect(fieldsByAction(ContractActionSchema)).toStrictEqual(
      fieldsByAction(AssistantActionSchema)
    );
  });

  it("lists the aspects of images, their cost and the longest prompt", () => {
    expect(ContractAspectSchema.literals).toStrictEqual(
      ImageAspectSchema.literals
    );
    expect([contractImageCost, contractPromptLength]).toStrictEqual([
      imageRequestCost,
      maxImagePromptLength,
    ]);
  });

  it("takes a workspace's image provider by the domain's rules", () => {
    expect([
      maxImageProviderAddressLength,
      maxImageProviderModelLength,
      maxImageProviderKeyLength,
    ]).toStrictEqual([
      maxProviderAddressLength,
      maxProviderModelLength,
      maxProviderKeyLength,
    ]);
    expect([
      imageProviderModelPattern.source,
      imageProviderKeyPattern.source,
    ]).toStrictEqual([providerModelPattern.source, providerKeyPattern.source]);
  });

  it("takes a workspace's text provider by the domain's rules", () => {
    expect(ContractTextKindSchema.literals).toStrictEqual(
      TextProviderKindSchema.literals
    );
    expect([anthropicApiAddress, contractOwnTextRequests]).toStrictEqual([
      anthropicAddress,
      ownTextRequestsPerDay,
    ]);
  });

  it("knows the providers the contract's catalogue names, at its addresses", () => {
    expect(AiProviderIdSchema.literals).toStrictEqual(
      ConnectedProviderIdSchema.literals
    );

    // The text providers are those the catalogue offers text from.
    for (const provider of AiProviderIdSchema.literals) {
      expect(aiProviders[provider].text !== null).toBe(
        TextProviderIdSchema.literals.some((known) => known === provider)
      );
      expect(aiProviders[provider].fixedAddress).toBe(
        fixedAddressProviders.has(provider)
      );
    }

    for (const provider of TextProviderIdSchema.literals) {
      expect([
        aiProviders[provider].text?.baseUrl ?? null,
        aiProviderKind(provider),
      ]).toStrictEqual([providerAddresses[provider], kindOfProvider(provider)]);
    }

    expect(providerOfKind("anthropic")).toBe(aiProviderOfKind("anthropic"));
    expect(providerOfKind("openai-compatible")).toBe(
      aiProviderOfKind("openai-compatible")
    );
  });

  it("makes images with the providers the catalogue offers them from, at its addresses, in its dimensions", () => {
    expect(AiImageProviderIdSchema.literals).toStrictEqual(
      ImageProviderIdSchema.literals
    );

    for (const provider of ImageProviderIdSchema.literals) {
      const offer = aiImageProviders[provider];

      // The provider's entry offers the same, and nobody else offers images.
      expect(aiProviders[provider].image).toStrictEqual(offer);
      expect(offer.baseUrl).toBe(imageProviderAddresses[provider]);

      for (const aspect of ImageAspectSchema.literals) {
        expect(imageDimensionsOf(provider, aspect)).toStrictEqual({
          [offer.dimensions.as]: offer.dimensions.values[aspect],
        });
      }
    }

    for (const provider of AiProviderIdSchema.literals) {
      expect(aiProviders[provider].image !== null).toBe(
        ImageProviderIdSchema.literals.some((known) => known === provider)
      );
    }
  });

  it("makes videos with the providers the catalogue offers them from, as it says each takes them", () => {
    expect(AiVideoProviderIdSchema.literals).toStrictEqual(
      VideoProviderIdSchema.literals
    );

    for (const provider of VideoProviderIdSchema.literals) {
      const { models: _models, ...offer } = aiVideoProviders[provider];

      expect(aiProviders[provider].video).toStrictEqual(
        aiVideoProviders[provider]
      );
      expect(offer).toStrictEqual(videoOffers[provider]);
    }

    for (const provider of AiProviderIdSchema.literals) {
      expect(aiProviders[provider].video !== null).toBe(
        VideoProviderIdSchema.literals.some((known) => known === provider)
      );
    }

    expect(VideoFailureReasonSchema.literals).toStrictEqual(
      ServerVideoFailureReasonSchema.literals
    );
    expect(VideoFailureReasonSchema.literals).toStrictEqual(
      VideoNoticeReasonSchema.literals
    );
    expect([contractVideosPerDay, maxVideoPromptLength]).toStrictEqual([
      videosPerDay,
      serverVideoPromptLength,
    ]);
  });

  it("composes slide videos with the services the catalogue offers, on its terms", () => {
    expect(AiCompositionProviderIdSchema.literals).toStrictEqual(
      CompositionProviderIdSchema.literals
    );

    for (const provider of CompositionProviderIdSchema.literals) {
      expect(aiCompositionProviders[provider]).toStrictEqual(
        compositionOffers[provider]
      );
      expect(aiProviders[provider].composition).toStrictEqual(
        compositionOffers[provider]
      );
    }

    for (const provider of AiProviderIdSchema.literals) {
      expect(aiProviders[provider].composition !== null).toBe(
        CompositionProviderIdSchema.literals.some((known) => known === provider)
      );
      expect(aiProviders[provider].fixedAddress).toBe(
        fixedAddressProviders.has(provider)
      );
      expect(aiFixedAddresses(provider)).toStrictEqual(
        fixedAddressesOf(provider)
      );
    }
  });

  it("names a slide video's states, reasons and choices as the contract does", () => {
    expect([
      SlideshowFailureReasonSchema.literals,
      SlideshowFailureReasonSchema.literals,
    ]).toStrictEqual([
      ServerSlideshowReasonSchema.literals,
      SlideshowNoticeReasonSchema.literals,
    ]);
    expect(SlideshowRejectionSchema.literals).toStrictEqual(
      SlideshowRejected.fields.reason.literals
    );
    expect([
      ContractSlideshowStatusSchema.literals,
      ContractMotionSchema.literals,
      ContractTransitionSchema.literals,
    ]).toStrictEqual([
      SlideshowStatusSchema.literals,
      SlideMotionSchema.literals,
      SlideTransitionSchema.literals,
    ]);
    expect([
      contractSlideshowsPerDay,
      contractMinSlides,
      contractMaxSlides,
      contractCaptionLength,
      contractMinSeconds,
      contractMaxSeconds,
      contractDefaultSeconds,
      contractMaxSlideshowSeconds,
      contractSlideshowsListed,
    ]).toStrictEqual([
      slideshowsPerDay,
      minSlides,
      maxSlides,
      maxSlideCaptionLength,
      minSecondsPerSlide,
      maxSecondsPerSlide,
      defaultSecondsPerSlide,
      maxSlideshowSeconds,
      maxSlideshowsListed,
    ]);
  });

  it("makes voice-overs and transcripts with the providers the catalogue offers them from", () => {
    expect(AiSpeechProviderIdSchema.literals).toStrictEqual(
      SpeechProviderIdSchema.literals
    );
    expect(AiTranscriptionProviderIdSchema.literals).toStrictEqual(
      TranscriptionProviderIdSchema.literals
    );

    for (const provider of SpeechProviderIdSchema.literals) {
      const offer = aiSpeechProviders[provider];

      expect(aiProviders[provider].speech).toStrictEqual(offer);
      expect([offer.baseUrl, offer.voices !== null]).toStrictEqual([
        speechOffers[provider].baseUrl,
        speechOffers[provider].takesVoice,
      ]);
    }

    for (const provider of TranscriptionProviderIdSchema.literals) {
      expect(aiProviders[provider].transcription).toStrictEqual(
        aiTranscriptionProviders[provider]
      );
      expect(aiTranscriptionProviders[provider].baseUrl).toBe(
        transcriptionAddresses[provider]
      );
    }

    for (const provider of AiProviderIdSchema.literals) {
      expect(aiProviders[provider].speech !== null).toBe(
        SpeechProviderIdSchema.literals.some((known) => known === provider)
      );
      expect(aiProviders[provider].transcription !== null).toBe(
        TranscriptionProviderIdSchema.literals.some(
          (known) => known === provider
        )
      );
    }

    expect(AudioFailureReasonSchema.literals).toStrictEqual(
      ServerAudioFailureReasonSchema.literals
    );
    expect([
      contractVoiceoversPerDay,
      contractTranscriptionsPerDay,
      contractVoiceoverTextLength,
      contractTranscriptionBytes,
    ]).toStrictEqual([
      voiceoversPerDay,
      transcriptionsPerDay,
      maxVoiceoverTextLength,
      maxTranscriptionBytes,
    ]);
  });

  it("connects the providers at the catalogue's addresses, with the uses it says each offers", () => {
    expect(ContractCapabilitySchema.literals).toStrictEqual(
      AiCapabilitySchema.literals
    );

    for (const provider of ConnectedProviderIdSchema.literals) {
      expect(aiProviders[provider].baseUrl).toBe(connectionAddresses[provider]);
      expect(aiProviders[provider].text?.models[0] ?? null).toBe(
        firstTextModels[provider]
      );

      for (const capability of AiCapabilitySchema.literals) {
        expect(aiProviderOffers(provider, capability)).toBe(
          offersCapability(provider, capability)
        );

        const address = "https://proxy.example.com/v1";

        expect(aiCapabilityAddress(provider, capability, address)).toBe(
          capabilityAddressOf(provider, capability, address)
        );
      }
    }

    // A use at its provider's own address is at the catalogue's own.
    expect(
      capabilityAddressOf("google", "text", connectionAddresses.google ?? "")
    ).toBe(providerAddresses.google);
  });
});
