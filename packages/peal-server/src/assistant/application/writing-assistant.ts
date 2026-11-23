import { Context, Effect, Layer } from "effect";
import type { Option } from "effect";

import type { AssistantQuotaExceeded } from "#assistant/application/assistant-quota-exceeded.ts";
import type { AssistantUnavailable } from "#assistant/application/assistant-unavailable.ts";
import type { CapabilityNotOffered } from "#assistant/application/capability-not-offered.ts";
import type { ImageFailed } from "#assistant/application/image-failed.ts";
import type { ImageNotStored } from "#assistant/application/image-not-stored.ts";
import type { ImageProviderKeyRequired } from "#assistant/application/image-provider-key-required.ts";
import type { ImageProviderRefused } from "#assistant/application/image-provider-refused.ts";
import type { ImagesBusy } from "#assistant/application/images-busy.ts";
import type { ModelRequired } from "#assistant/application/model-required.ts";
import type { OwnImagesExhausted } from "#assistant/application/own-images-exhausted.ts";
import type { OwnTextBusy } from "#assistant/application/own-text-busy.ts";
import type { OwnTextExhausted } from "#assistant/application/own-text-exhausted.ts";
import type { AssistantAllowance } from "#assistant/application/ports/assistant-allowance.ts";
import type { AssistantUsage } from "#assistant/application/ports/assistant-usage.ts";
import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import type {
  GeneratedImage,
  GeneratedImages,
} from "#assistant/application/ports/generated-images.ts";
import type { ImageModel } from "#assistant/application/ports/image-model.ts";
import type { ImageProviders } from "#assistant/application/ports/image-providers.ts";
import type { ImageSlots } from "#assistant/application/ports/image-slots.ts";
import type { OwnImageCounts } from "#assistant/application/ports/own-image-counts.ts";
import type { OwnImageModel } from "#assistant/application/ports/own-image-model.ts";
import type { OwnTextCounts } from "#assistant/application/ports/own-text-counts.ts";
import type { OwnWritingModel } from "#assistant/application/ports/own-writing-model.ts";
import type { PlatformLimits } from "#assistant/application/ports/platform-limits.ts";
import type { ProviderAddressCheck } from "#assistant/application/ports/provider-address-check.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import type { TextProviders } from "#assistant/application/ports/text-providers.ts";
import type { TextSlots } from "#assistant/application/ports/text-slots.ts";
import type { WritingModel } from "#assistant/application/ports/writing-model.ts";
import type { ProviderAddressNotPublic } from "#assistant/application/provider-address-not-public.ts";
import type { ProviderKeyRequired } from "#assistant/application/provider-key-required.ts";
import type { ProviderNotConnected } from "#assistant/application/provider-not-connected.ts";
import type { ProviderSecretsNotConfigured } from "#assistant/application/provider-secrets-not-configured.ts";
import type { TestModelRequired } from "#assistant/application/test-model-required.ts";
import type { TextProviderKeyRequired } from "#assistant/application/text-provider-key-required.ts";
import type { TextProviderNotSet } from "#assistant/application/text-provider-not-set.ts";
import type { TextProviderRefused } from "#assistant/application/text-provider-refused.ts";
import { assistantStatus } from "#assistant/application/use-cases/assistant-status.ts";
import type { AssistantStatus } from "#assistant/application/use-cases/assistant-status.ts";
import {
  listModels,
  setModel,
  unsetModel,
} from "#assistant/application/use-cases/capability-model-settings.ts";
import type {
  CapabilityModelChange,
  CapabilityModelView,
} from "#assistant/application/use-cases/capability-model-settings.ts";
import { generateImage } from "#assistant/application/use-cases/generate-image.ts";
import type { ImageGenerationRequest } from "#assistant/application/use-cases/generate-image.ts";
import {
  removeImageProvider,
  saveImageProvider,
  viewImageProvider,
} from "#assistant/application/use-cases/image-provider-settings.ts";
import type {
  ImageProviderChange,
  ImageProviderView,
} from "#assistant/application/use-cases/image-provider-settings.ts";
import {
  connectProvider,
  disconnectProvider,
  listConnections,
  testProvider,
} from "#assistant/application/use-cases/provider-connection-settings.ts";
import type {
  ConnectionChange,
  ConnectionView,
} from "#assistant/application/use-cases/provider-connection-settings.ts";
import { suggest } from "#assistant/application/use-cases/suggest.ts";
import type { SuggestionRequest } from "#assistant/application/use-cases/suggest.ts";
import {
  removeTextProvider,
  saveTextProvider,
  testTextProvider,
  viewTextProvider,
} from "#assistant/application/use-cases/text-provider-settings.ts";
import type {
  TextProviderChange,
  TextProviderView,
} from "#assistant/application/use-cases/text-provider-settings.ts";
import type { WritingFailed } from "#assistant/application/writing-failed.ts";
import type {
  AiCapability,
  ConnectedProviderId,
} from "#assistant/domain/ai-capability.ts";
import type { AnswerRejected } from "#assistant/domain/answer-rejected.ts";
import type { DraftRejected } from "#assistant/domain/draft-rejected.ts";
import type { ProviderAddressRejected } from "#assistant/domain/provider-address-rejected.ts";
import type { ProviderSettingRejected } from "#assistant/domain/provider-setting-rejected.ts";
import type { Suggestion } from "#assistant/domain/suggestion.ts";
import type { MeteredUsage } from "#shared/application/metered-usage.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { AllowanceReached } from "#shared/domain/allowance-reached.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

type AssistantPorts =
  | AssistantAllowance
  | MeteredUsage
  | AssistantUsage
  | CapabilityModels
  | GeneratedImages
  | ImageModel
  | ImageProviders
  | ImageSlots
  | OwnImageCounts
  | OwnImageModel
  | OwnTextCounts
  | OwnWritingModel
  | PlatformLimits
  | ProviderAddressCheck
  | ProviderConnections
  | TextProviders
  | TextSlots
  | WritingModel;

/** What to do with which text, in the actor's workspace. */
export type AssistantRequest = Omit<SuggestionRequest, "actor">;

/** What image to make, in the actor's workspace. */
export type ImageAsked = Omit<ImageGenerationRequest, "actor">;

export type GenerateImageFailure =
  | AllowanceReached
  | AssistantQuotaExceeded
  | AssistantUnavailable
  | DraftRejected
  | ImageFailed
  | ImageNotStored
  | ImageProviderRefused
  | ImagesBusy
  | MissingPermission
  | OwnImagesExhausted
  | PlanLimitReached;

export type SaveImageProviderFailure =
  | ImageProviderKeyRequired
  | MissingPermission
  | ProviderAddressNotPublic
  | ProviderAddressRejected
  | ProviderSecretsNotConfigured
  | ProviderSettingRejected;

export type SaveTextProviderFailure =
  | MissingPermission
  | ProviderAddressNotPublic
  | ProviderAddressRejected
  | ProviderSecretsNotConfigured
  | ProviderSettingRejected
  | TextProviderKeyRequired;

export type ConnectProviderFailure =
  | MissingPermission
  | ProviderAddressNotPublic
  | ProviderAddressRejected
  | ProviderKeyRequired
  | ProviderSecretsNotConfigured
  | ProviderSettingRejected;

export type TestProviderFailure =
  | AnswerRejected
  | CapabilityNotOffered
  | MissingPermission
  | OwnTextBusy
  | OwnTextExhausted
  | ProviderNotConnected
  | ProviderSettingRejected
  | TestModelRequired
  | TextProviderRefused
  | WritingFailed;

export type SetModelFailure =
  | CapabilityNotOffered
  | MissingPermission
  | ModelRequired
  | ProviderNotConnected
  | ProviderSettingRejected;

export type SuggestFailure =
  | AllowanceReached
  | AnswerRejected
  | AssistantQuotaExceeded
  | AssistantUnavailable
  | DraftRejected
  | MissingPermission
  | OwnTextBusy
  | OwnTextExhausted
  | TextProviderRefused
  | WritingFailed;

export type TestTextProviderFailure =
  | AnswerRejected
  | MissingPermission
  | OwnTextBusy
  | OwnTextExhausted
  | TextProviderNotSet
  | TextProviderRefused
  | WritingFailed;

/**
 * The writing assistant's use cases, for someone acting in a workspace:
 * each checks that the actor holds `assistant:use` (and `media:upload` to
 * make an image, which lands in the media library), or `assistant:configure`
 * for the image and text providers the workspace brings, then works for
 * the actor's workspace only. What API handlers call.
 */
export class WritingAssistant extends Context.Service<
  WritingAssistant,
  {
    readonly status: (
      actor: Actor
    ) => Effect.Effect<AssistantStatus, MissingPermission>;
    readonly suggest: (
      actor: Actor,
      request: AssistantRequest
    ) => Effect.Effect<Suggestion, SuggestFailure>;
    readonly generateImage: (
      actor: Actor,
      request: ImageAsked
    ) => Effect.Effect<GeneratedImage, GenerateImageFailure>;
    /** The image provider the workspace brought, if any; never its key. */
    readonly imageProvider: (
      actor: Actor
    ) => Effect.Effect<Option.Option<ImageProviderView>, MissingPermission>;
    readonly saveImageProvider: (
      actor: Actor,
      change: ImageProviderChange
    ) => Effect.Effect<ImageProviderView, SaveImageProviderFailure>;
    readonly removeImageProvider: (
      actor: Actor
    ) => Effect.Effect<void, MissingPermission>;
    /** The text provider the workspace brought, if any; never its key. */
    readonly textProvider: (
      actor: Actor
    ) => Effect.Effect<Option.Option<TextProviderView>, MissingPermission>;
    readonly saveTextProvider: (
      actor: Actor,
      change: TextProviderChange
    ) => Effect.Effect<TextProviderView, SaveTextProviderFailure>;
    readonly removeTextProvider: (
      actor: Actor
    ) => Effect.Effect<void, MissingPermission>;
    /** Sends the workspace's text provider one short request, to tell whether it works. */
    readonly testTextProvider: (
      actor: Actor
    ) => Effect.Effect<void, TestTextProviderFailure>;
    /** The providers the workspace connected; never their keys. */
    readonly providers: (
      actor: Actor
    ) => Effect.Effect<readonly ConnectionView[], MissingPermission>;
    readonly connectProvider: (
      actor: Actor,
      provider: ConnectedProviderId,
      change: ConnectionChange
    ) => Effect.Effect<ConnectionView, ConnectProviderFailure>;
    readonly disconnectProvider: (
      actor: Actor,
      provider: ConnectedProviderId
    ) => Effect.Effect<void, MissingPermission>;
    /** Sends a connected provider one short request for text. */
    readonly testProvider: (
      actor: Actor,
      provider: ConnectedProviderId,
      asked: { readonly model?: string }
    ) => Effect.Effect<void, TestProviderFailure>;
    /** Every use, chosen or not. */
    readonly models: (
      actor: Actor
    ) => Effect.Effect<readonly CapabilityModelView[], MissingPermission>;
    readonly setModel: (
      actor: Actor,
      capability: AiCapability,
      change: CapabilityModelChange
    ) => Effect.Effect<CapabilityModelView, SetModelFailure>;
    readonly unsetModel: (
      actor: Actor,
      capability: AiCapability
    ) => Effect.Effect<void, MissingPermission>;
  }
>()("peal-server/assistant/application/WritingAssistant") {
  /** The use cases, running on the ports the layer is given. */
  static readonly layer = Layer.effect(
    WritingAssistant,
    Effect.gen(function* WritingAssistantLive() {
      const ports = yield* Effect.context<AssistantPorts>();

      const allowed = <A, E>(
        actor: Actor,
        useCase: Effect.Effect<A, E, AssistantPorts>
      ): Effect.Effect<A, E | MissingPermission> =>
        Effect.fromResult(authorize(actor, "assistant:use")).pipe(
          Effect.andThen(useCase),
          Effect.provideContext(ports)
        );

      // The workspace's own providers: `assistant:configure` (owners,
      // admins, Peal's command line, and the keys given it), not
      // `assistant:use`.
      const configuring = <A, E>(
        actor: Actor,
        useCase: Effect.Effect<A, E, AssistantPorts>
      ): Effect.Effect<A, E | MissingPermission> =>
        Effect.fromResult(authorize(actor, "assistant:configure")).pipe(
          Effect.andThen(useCase),
          Effect.provideContext(ports)
        );

      return WritingAssistant.of({
        connectProvider: (actor, provider, change) =>
          configuring(actor, connectProvider(actor, provider, change)),
        disconnectProvider: (actor, provider) =>
          configuring(actor, disconnectProvider(actor, provider)),
        generateImage: (actor, request) =>
          Effect.fromResult(authorize(actor, "media:upload")).pipe(
            Effect.andThen(allowed(actor, generateImage({ ...request, actor })))
          ),
        imageProvider: (actor) => configuring(actor, viewImageProvider(actor)),
        models: (actor) => configuring(actor, listModels(actor)),
        providers: (actor) => configuring(actor, listConnections(actor)),
        removeImageProvider: (actor) =>
          configuring(actor, removeImageProvider(actor)),
        removeTextProvider: (actor) =>
          configuring(actor, removeTextProvider(actor)),
        saveImageProvider: (actor, change) =>
          configuring(actor, saveImageProvider(actor, change)),
        saveTextProvider: (actor, change) =>
          configuring(actor, saveTextProvider(actor, change)),
        setModel: (actor, capability, change) =>
          configuring(actor, setModel(actor, capability, change)),
        status: (actor) => allowed(actor, assistantStatus(actor.workspaceId)),
        suggest: (actor, request) =>
          allowed(actor, suggest({ ...request, actor })),
        testProvider: (actor, provider, asked) =>
          configuring(actor, testProvider(actor, provider, asked)),
        testTextProvider: (actor) =>
          configuring(actor, testTextProvider(actor)),
        textProvider: (actor) => configuring(actor, viewTextProvider(actor)),
        unsetModel: (actor, capability) =>
          configuring(actor, unsetModel(actor, capability)),
      });
    })
  );
}
