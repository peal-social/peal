import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { AiCapabilityNotOffered } from "./ai-capability-not-offered.ts";
import { AiModelRequired } from "./ai-model-required.ts";
import { AiProviderAddressRefused } from "./ai-provider-address-refused.ts";
import { AiProviderKeyRequired } from "./ai-provider-key-required.ts";
import { AiProviderNotConnected } from "./ai-provider-not-connected.ts";
import {
  AiCapabilitySchema,
  AiImageProviderIdSchema,
  AiProviderIdSchema,
} from "./ai-providers.ts";
import { AssistantFailed } from "./assistant-failed.ts";
import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import { AssistantQuotaExceeded } from "./assistant-quota-exceeded.ts";
import { AssistantSecretsNotConfigured } from "./assistant-secrets-not-configured.ts";
import { AssistantUnavailable } from "./assistant-unavailable.ts";
import { Authentication } from "./authentication.ts";
import { MoneySchema } from "./billing-plans.ts";
import { deprecated } from "./deprecation.ts";
import { Forbidden } from "./forbidden.ts";
import { ImageProviderAddressRefused } from "./image-provider-address-refused.ts";
import { ImageProviderKeyRequired } from "./image-provider-key-required.ts";
import { ImageProviderRefused } from "./image-provider-refused.ts";
import { MediaImportBusy } from "./media-import-busy.ts";
import { MediaStoreUnavailable } from "./media-store-unavailable.ts";
import { MediaSchema } from "./media.ts";
import { OwnImageLimitReached } from "./own-image-limit-reached.ts";
import { OwnTextLimitReached } from "./own-text-limit-reached.ts";
import { PlanLimitReached } from "./plan-limit-reached.ts";
import { PlatformSchema } from "./platform.ts";
import { maxPostTextLength } from "./post-text.ts";
import { UnitPriceSchema } from "./rate-card.ts";
import { TextProviderAddressRefused } from "./text-provider-address-refused.ts";
import { TextProviderBusy } from "./text-provider-busy.ts";
import { TextProviderKeyRequired } from "./text-provider-key-required.ts";
import { TextProviderNotFound } from "./text-provider-not-found.ts";
import { TextProviderRefused } from "./text-provider-refused.ts";
import { UsageAllowanceReached } from "./usage-allowance-reached.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

/**
 * The tones the assistant rewrites a post in. The server's list
 * (src/assistant/domain/tone.ts) is the source; a test keeps the two equal.
 */
export const AssistantToneSchema = Schema.Literals([
  "professional",
  "friendly",
  "casual",
  "enthusiastic",
  "witty",
]).annotate({ identifier: "AssistantTone" });

export type AssistantTone = typeof AssistantToneSchema.Type;

/**
 * The languages the assistant translates into, as BCP 47 tags. The server's
 * list (src/assistant/domain/translation-language.ts) is the source.
 */
export const TranslationLanguageSchema = Schema.Literals([
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "nl",
  "pl",
  "ja",
  "zh-Hans",
]).annotate({ identifier: "TranslationLanguage" });

export type TranslationLanguage = typeof TranslationLanguageSchema.Type;

/**
 * What the assistant does with the text:
 *
 * - `rewrite`: the same post in another `tone`.
 * - `shorten`: the post cut down to fit `platform`'s limits.
 * - `translate`: the post in another `language`.
 * - `hashtags`: hashtags that suit the post, to add to it.
 * - `write`: a first post from a subject: the request's `text` says what
 *   the post is about, in the person's words. Optionally in a `tone`, in a
 *   `language` (else the subject's own), and within the limits of a
 *   `platform`.
 *
 * With a `platform`, `media: true` says the post shows images or videos:
 * the text is then held to the platform's limit for a caption, where it
 * sets one (Telegram: 1,024 characters rather than 4,096).
 */
export const AssistantActionSchema = Schema.Union([
  Schema.TaggedStruct("rewrite", { tone: AssistantToneSchema }),
  Schema.TaggedStruct("shorten", {
    media: Schema.optionalKey(Schema.Boolean),
    platform: PlatformSchema,
  }),
  Schema.TaggedStruct("translate", { language: TranslationLanguageSchema }),
  Schema.TaggedStruct("hashtags", {}),
  Schema.TaggedStruct("write", {
    language: Schema.optionalKey(TranslationLanguageSchema),
    media: Schema.optionalKey(Schema.Boolean),
    platform: Schema.optionalKey(PlatformSchema),
    tone: Schema.optionalKey(AssistantToneSchema),
  }),
]).annotate({ identifier: "AssistantAction" });

export type AssistantAction = typeof AssistantActionSchema.Type;

export const SuggestionRequestSchema = Schema.Struct({
  action: AssistantActionSchema,
  // The post's text, as plain text, or for `write` the post's subject. The
  // assistant takes at most the status's `maxTextLength`; this bounds what
  // the request can carry.
  text: Schema.String.check(Schema.isMaxLength(maxPostTextLength)),
}).annotate({ identifier: "SuggestionRequest" });

export type SuggestionRequest = typeof SuggestionRequestSchema.Type;

/**
 * What the assistant offers, for the person to accept or discard: a `text`
 * that replaces the post's, or `hashtags` to add to it, each with its #.
 */
export const SuggestionSchema = Schema.Union([
  Schema.TaggedStruct("text", { text: Schema.String }),
  Schema.TaggedStruct("hashtags", { hashtags: Schema.Array(Schema.String) }),
]).annotate({ identifier: "Suggestion" });

export type Suggestion = typeof SuggestionSchema.Type;

/**
 * The aspects the assistant makes images in: `square`, `landscape` (wider
 * than tall) or `portrait` (taller than wide). The server's list
 * (src/assistant/domain/image-aspect.ts) is the source.
 */
export const ImageAspectSchema = Schema.Literals([
  "square",
  "landscape",
  "portrait",
]).annotate({ identifier: "ImageAspect" });

export type ImageAspect = typeof ImageAspectSchema.Type;

/**
 * How many of the day's assistant requests an image costs, and the longest
 * description one is made from. The server's values
 * (src/assistant/domain/) are the source.
 */
export const imageRequestCost = 5;

export const maxImagePromptLength = 1000;

export const ImageRequestSchema = Schema.Struct({
  aspect: ImageAspectSchema,
  // What the image should show, as plain text, sent to the image provider
  // as it is. The assistant takes 1 to the status's
  // `images.maxPromptLength` characters; this bounds what the request can
  // carry.
  prompt: Schema.String.check(Schema.isMaxLength(maxPostTextLength)),
}).annotate({ identifier: "ImageRequest" });

export type ImageRequest = typeof ImageRequestSchema.Type;

/**
 * Who makes the workspace's images: `workspace`, the image provider the
 * workspace brought (its own key, outside Peal's allowance), or `server`,
 * the image model the server's operator set up.
 */
export const AssistantImageSourceSchema = Schema.Literals([
  "workspace",
  "server",
]).annotate({ identifier: "AssistantImageSource" });

export type AssistantImageSource = typeof AssistantImageSourceSchema.Type;

/**
 * One of the assistant's meters this calendar month (UTC), on a server
 * that bills, for the server's models: what the billing account's month
 * includes, what its workspaces used, the most it may use (the allowance,
 * and what its ceiling pays for past it), the price of each unit past the
 * allowance and the ceiling, in US dollar cents excluding tax. The
 * included allowance and the prices are not decided yet (`priceConfirmed`
 * false): clients show them as coming.
 */
export const AssistantMonthSchema = Schema.Struct({
  allowance: Schema.Int,
  // The most the account may spend past the allowance a month.
  ceiling: MoneySchema,
  // The most units it may use this month.
  most: Schema.Int,
  // What units past the allowance cost: `cents` for every `per`.
  price: UnitPriceSchema,
  // Whether the owner confirmed the allowance and the price.
  priceConfirmed: Schema.Boolean,
  // The first of next month, when the month's count starts again.
  resetsAt: Schema.DateTimeUtc,
  used: Schema.Int,
}).annotate({ identifier: "AssistantMonth" });

export type AssistantMonth = typeof AssistantMonthSchema.Type;

/**
 * Why the assistant does not write, or make images, for the workspace
 * when the server could: `paymentMethod`, its billing account has no
 * payment method, which the server's models need on a server that bills
 * (a provider of the workspace's own needs none).
 */
export const AssistantOffReasonSchema = Schema.Literal(
  "paymentMethod"
).annotate({ identifier: "AssistantOffReason" });

export type AssistantOffReason = typeof AssistantOffReasonSchema.Type;

export const AssistantImagesStatusSchema = Schema.Struct({
  // The aspects an image can be made in.
  aspects: Schema.Array(ImageAspectSchema),
  // Whether images can be made: the workspace brought its own image
  // provider, or the server has an image model. Clients hide images
  // otherwise.
  available: Schema.Boolean,
  // How many of the day's requests images of the server's model may take:
  // the day's limit, but none while the workspace's plan is on trial.
  // Under `requestCost`, the workspace makes no image with it (the request
  // is refused with AssistantQuotaExceeded). It bounds nothing while
  // `source` is `workspace`.
  dailyLimit: Schema.Int,
  // The longest description an image is made from, in UTF-16 code units.
  maxPromptLength: Schema.Int,
  // How many of the day's requests an image costs: 0 when `source` is
  // `workspace`.
  requestCost: Schema.Int,
  // On a server that bills, the month of the server's images; null
  // elsewhere, and while `source` is `workspace`.
  month: Schema.NullOr(AssistantMonthSchema),
  // Why images are off when the server could make them; null otherwise.
  reason: Schema.NullOr(AssistantOffReasonSchema),
  // Who makes the images, or null when nobody does (`available` false).
  source: Schema.NullOr(AssistantImageSourceSchema),
}).annotate({ identifier: "AssistantImagesStatus" });

export type AssistantImagesStatus = typeof AssistantImagesStatusSchema.Type;

/**
 * Whether the workspace makes videos, with the provider it chose for them
 * and its own key (the server's operator offers none), and how many it may
 * still ask for today.
 */
export const AssistantVideosStatusSchema = Schema.Struct({
  // Whether videos can be made: a provider and a model are chosen for
  // videos and its key can be read. Clients hide videos otherwise.
  available: Schema.Boolean,
  // How many videos the workspace may ask for each UTC day, and how many
  // are left today (`resetsAt`, midnight UTC).
  dailyLimit: Schema.Int,
  // The longest description a video is made from, in UTF-16 code units.
  maxPromptLength: Schema.Int,
  // The provider chosen for videos, whose `video` offer in
  // `peal-contract/ai-providers` says the aspects, lengths and first
  // frames it takes; null when none is.
  provider: Schema.NullOr(AiProviderIdSchema),
  remaining: Schema.Int,
}).annotate({ identifier: "AssistantVideosStatus" });

export type AssistantVideosStatus = typeof AssistantVideosStatusSchema.Type;

/**
 * Whether the workspace makes voice-overs, with the provider it chose for
 * them and its own key (the server's operator offers none), and how many
 * it may still ask for today.
 */
export const AssistantVoiceoversStatusSchema = Schema.Struct({
  // Whether voice-overs can be made: a provider and a model are chosen for
  // `speech` and its key can be read. Clients hide them otherwise.
  available: Schema.Boolean,
  // How many voice-overs the workspace may ask for each UTC day, and how
  // many are left today (midnight UTC starts the count again).
  dailyLimit: Schema.Int,
  // The longest text a voice-over is made from, in UTF-16 code units.
  maxTextLength: Schema.Int,
  // The provider chosen for voice-overs, whose `speech` offer in
  // `peal-contract/ai-providers` says the voices it takes; null when none
  // is.
  provider: Schema.NullOr(AiProviderIdSchema),
  remaining: Schema.Int,
}).annotate({ identifier: "AssistantVoiceoversStatus" });

export type AssistantVoiceoversStatus =
  typeof AssistantVoiceoversStatusSchema.Type;

/**
 * Whether the workspace transcribes its audio and videos, with the
 * provider it chose and its own key, and how many it may still ask for
 * today.
 */
export const AssistantTranscriptionsStatusSchema = Schema.Struct({
  // Whether transcripts can be made: a provider and a model are chosen for
  // `transcription` and its key can be read.
  available: Schema.Boolean,
  dailyLimit: Schema.Int,
  // The largest file a transcript is made of, in bytes.
  maxBytes: Schema.Int,
  provider: Schema.NullOr(AiProviderIdSchema),
  remaining: Schema.Int,
}).annotate({ identifier: "AssistantTranscriptionsStatus" });

export type AssistantTranscriptionsStatus =
  typeof AssistantTranscriptionsStatusSchema.Type;

/**
 * Whether the workspace composes slide videos, with the service it chose
 * for `composition` and its own key, and how many it may still ask for
 * today.
 */
export const AssistantSlideshowsStatusSchema = Schema.Struct({
  // Whether slide videos can be composed: a service is chosen for
  // `composition` and its key can be read. Clients hide them otherwise.
  // It stays true without a payment method: `paymentMethodRequired` says
  // the request would be refused, so clients offer the upgrade instead.
  available: Schema.Boolean,
  dailyLimit: Schema.Int,
  // On a server that bills, whether the workspace's billing account needs
  // a payment method first (CompositionNeedsPayment); false elsewhere.
  paymentMethodRequired: Schema.Boolean,
  provider: Schema.NullOr(AiProviderIdSchema),
  remaining: Schema.Int,
  // Whether the chosen service's connection is its sandbox, which
  // watermarks every video.
  sandbox: Schema.Boolean,
}).annotate({ identifier: "AssistantSlideshowsStatus" });

export type AssistantSlideshowsStatus =
  typeof AssistantSlideshowsStatusSchema.Type;

/**
 * Who writes the workspace's text: `workspace`, the text provider the
 * workspace brought (its own key, outside Peal's allowance), or `server`,
 * the language model the server's operator set up.
 */
export const AssistantTextSourceSchema = Schema.Literals([
  "workspace",
  "server",
]).annotate({ identifier: "AssistantTextSource" });

export type AssistantTextSource = typeof AssistantTextSourceSchema.Type;

export const AssistantStatusSchema = Schema.Struct({
  // Whether the assistant writes for the workspace: it brought its own
  // text provider, or the server has a language model. Clients hide the
  // assistant otherwise.
  available: Schema.Boolean,
  // How many requests of the server's model the workspace may send each
  // UTC day, and how many are left today. They bound nothing while
  // `source` is `workspace`.
  dailyLimit: Schema.Int,
  // Whether the assistant makes images, and on what terms.
  images: AssistantImagesStatusSchema,
  // The longest text the assistant takes, in UTF-16 code units.
  maxTextLength: Schema.Int,
  // On a server that bills, the month of the server's requests; null
  // elsewhere, and while `source` is `workspace`. The daily fields then
  // tell the month: `dailyLimit` its most, `remaining` what is left,
  // `resetsAt` the first of next month.
  month: Schema.NullOr(AssistantMonthSchema),
  // Why the assistant is off when the server could write; null otherwise.
  reason: Schema.NullOr(AssistantOffReasonSchema),
  remaining: Schema.Int,
  // Midnight UTC, when the day's count starts again.
  resetsAt: Schema.DateTimeUtc,
  // Whether the workspace composes slide videos, and how many are left
  // today.
  slideshows: AssistantSlideshowsStatusSchema,
  // Who writes the workspace's text, or null when nobody does
  // (`available` false).
  source: Schema.NullOr(AssistantTextSourceSchema),
  // Whether the workspace transcribes its audio and videos, and how many
  // are left today.
  transcriptions: AssistantTranscriptionsStatusSchema,
  // Whether the workspace makes videos, and how many are left today.
  videos: AssistantVideosStatusSchema,
  // Whether the workspace makes voice-overs, and how many are left today.
  voiceovers: AssistantVoiceoversStatusSchema,
}).annotate({ identifier: "AssistantStatus" });

export type AssistantStatus = typeof AssistantStatusSchema.Type;

/** The longest address, model and key a workspace's image provider takes. */
export const maxImageProviderAddressLength = 2048;

export const maxImageProviderModelLength = 200;

export const maxImageProviderKeyLength = 500;

/**
 * The image provider a workspace brought: where its prompts go and which
 * model is asked. Its key is never shown again: `keySet` says one is
 * stored, `keyUnreadable` that it can no longer be read (the server's
 * keys changed), and must be typed again.
 */
export const ImageProviderSchema = Schema.Struct({
  baseUrl: Schema.String,
  keySet: Schema.Literal(true),
  keyUnreadable: Schema.Boolean,
  model: Schema.String,
  // The provider by name (`aiImageProviders` in
  // `peal-contract/ai-providers`); one saved before providers had names
  // reads as `openai-compatible`.
  provider: AiImageProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "ImageProvider" });

export type ImageProvider = typeof ImageProviderSchema.Type;

/** The workspace's image provider, or null when it brought none. */
export const ImageProviderSettingSchema = Schema.Struct({
  provider: Schema.NullOr(ImageProviderSchema),
}).annotate({ identifier: "ImageProviderSetting" });

export type ImageProviderSetting = typeof ImageProviderSettingSchema.Type;

/**
 * What a model name may hold: one line, without control or format
 * characters, not blank. The server's rule
 * (src/assistant/domain/image-provider.ts) is the source; a test keeps the
 * two equal.
 */
export const imageProviderModelPattern =
  /^(?=.*\S)[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]+$/u;

/** What a key may hold: visible ASCII, as an HTTP header does. */
export const imageProviderKeyPattern = /^[!-~]+$/u;

export const ImageProviderChangeSchema = Schema.Struct({
  // The provider's key, visible ASCII without spaces: required unless the
  // workspace has one stored and `baseUrl` stays exactly the same, when it
  // is kept.
  apiKey: Schema.optionalKey(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maxImageProviderKeyLength),
      Schema.isPattern(imageProviderKeyPattern, {
        expected: "a key of visible ASCII, without spaces",
      })
    )
  ),
  // The API's base address: for `openai-compatible`, the one
  // `/images/generations` follows, such as `https://images.example.com/v1`.
  // Left out, the provider's own address (`aiImageProviders` in
  // `peal-contract/ai-providers`); `openai-compatible` has none, and needs
  // it. This bounds what the request can carry; the address itself is at
  // most 2048 characters.
  baseUrl: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(8192))),
  // The model the provider is asked for, one line.
  model: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maxImageProviderModelLength),
    Schema.isPattern(imageProviderModelPattern, {
      expected: "a model's name on one line, without control characters",
    })
  ),
  // The provider by name, which sets the API it speaks and its default
  // address. Left out, `openai-compatible`.
  provider: Schema.optionalKey(AiImageProviderIdSchema),
}).annotate({ identifier: "ImageProviderChange" });

export type ImageProviderChange = typeof ImageProviderChangeSchema.Type;

/**
 * The API a workspace's text provider speaks: `anthropic`, Anthropic's
 * Messages API (`POST {baseUrl}/v1/messages`, its key as `x-api-key`), or
 * `openai-compatible`, any endpoint that serves the chat completions API
 * (`POST {baseUrl}/chat/completions`, its key as a bearer token).
 */
export const TextProviderKindSchema = Schema.Literals([
  "anthropic",
  "openai-compatible",
]).annotate({ identifier: "TextProviderKind" });

export type TextProviderKind = typeof TextProviderKindSchema.Type;

/** Where Anthropic's API is reached: the `baseUrl` of an `anthropic` provider. */
export const anthropicApiAddress = "https://api.anthropic.com";

/**
 * How many requests a workspace may send its own text provider each UTC
 * day. The server's value (src/assistant/domain/text-provider.ts) is the
 * source; a test keeps the two equal.
 */
export const ownTextRequestsPerDay = 500;

/**
 * The text provider a workspace brought: the API it speaks, where its
 * drafts go and which model is asked. Its key is never shown again:
 * `keySet` says one is stored, `keyUnreadable` that it can no longer be
 * read (the server's keys changed), and must be typed again.
 */
export const TextProviderSchema = Schema.Struct({
  baseUrl: Schema.String,
  keySet: Schema.Literal(true),
  keyUnreadable: Schema.Boolean,
  kind: TextProviderKindSchema,
  model: Schema.String,
  // The provider by name (`peal-contract/ai-providers`); one saved before
  // providers had names reads as its kind's: `anthropic`, else
  // `openai-compatible`.
  provider: AiProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "TextProvider" });

export type TextProvider = typeof TextProviderSchema.Type;

/** The workspace's text provider, or null when it brought none. */
export const TextProviderSettingSchema = Schema.Struct({
  provider: Schema.NullOr(TextProviderSchema),
}).annotate({ identifier: "TextProviderSetting" });

export type TextProviderSetting = typeof TextProviderSettingSchema.Type;

export const TextProviderChangeSchema = Schema.Struct({
  // The provider's key, visible ASCII without spaces: required unless the
  // workspace has one stored and `baseUrl` stays exactly the same, when it
  // is kept.
  apiKey: Schema.optionalKey(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maxImageProviderKeyLength),
      Schema.isPattern(imageProviderKeyPattern, {
        expected: "a key of visible ASCII, without spaces",
      })
    )
  ),
  // The API's base address: `https://api.anthropic.com` for Anthropic,
  // which `/v1/messages` follows; for an OpenAI-compatible endpoint, the
  // address `/chat/completions` follows, such as
  // `https://text.example.com/v1`. Left out, the provider's own address
  // (`aiProviders` in `peal-contract/ai-providers`); `openai-compatible`
  // has none, and needs it. This bounds what the request can carry; the
  // address itself is at most 2048 characters.
  baseUrl: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(8192))),
  // The API it speaks, read only when `provider` is left out: `anthropic`
  // names Anthropic, `openai-compatible` (or nothing) another endpoint.
  kind: Schema.optionalKey(TextProviderKindSchema),
  // The model the provider is asked for, one line.
  model: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maxImageProviderModelLength),
    Schema.isPattern(imageProviderModelPattern, {
      expected: "a model's name on one line, without control characters",
    })
  ),
  // The provider by name, which sets the API it speaks and its default
  // address. Left out, `kind` says it.
  provider: Schema.optionalKey(AiProviderIdSchema),
}).annotate({ identifier: "TextProviderChange" });

export type TextProviderChange = typeof TextProviderChangeSchema.Type;

/**
 * A provider the workspace connected: where it is reached and that its
 * key is kept. The key is never shown again: `keySet` says one is stored,
 * `keyUnreadable` that it can no longer be read (the server's keys
 * changed), and must be typed again. What the workspace uses it for is
 * `GET …/assistant/models`'s to say.
 */
export const AiProviderConnectionSchema = Schema.Struct({
  // Where the provider is reached: its own address (`baseUrl` of
  // `aiProviders` in `peal-contract/ai-providers`), or the one the
  // workspace gave, such as a proxy's. Each use's address follows from it
  // (`aiCapabilityAddress`).
  baseUrl: Schema.String,
  keySet: Schema.Literal(true),
  keyUnreadable: Schema.Boolean,
  provider: AiProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "AiProviderConnection" });

export type AiProviderConnection = typeof AiProviderConnectionSchema.Type;

/** The providers the workspace connected, in the catalogue's order. */
export const AiProviderConnectionsSchema = Schema.Struct({
  providers: Schema.Array(AiProviderConnectionSchema),
}).annotate({ identifier: "AiProviderConnections" });

export type AiProviderConnections = typeof AiProviderConnectionsSchema.Type;

export const AiProviderConnectionChangeSchema = Schema.Struct({
  // The provider's key, visible ASCII without spaces: required unless the
  // workspace has one stored for this provider that opens and `baseUrl`
  // stays exactly the same, when it is kept.
  apiKey: Schema.optionalKey(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maxImageProviderKeyLength),
      Schema.isPattern(imageProviderKeyPattern, {
        expected: "a key of visible ASCII, without spaces",
      })
    )
  ),
  // Where the provider is reached. Left out, its own address (`baseUrl` of
  // `aiProviders` in `peal-contract/ai-providers`); `openai-compatible`
  // has none, and needs it: the address `/chat/completions` and
  // `/images/generations` follow, such as `https://ai.example.com/v1`.
  // This bounds what the request can carry; the address itself is at most
  // 2048 characters.
  baseUrl: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(8192))),
}).annotate({ identifier: "AiProviderConnectionChange" });

export type AiProviderConnectionChange =
  typeof AiProviderConnectionChangeSchema.Type;

/**
 * What the workspace uses for one of its uses (`capability`): the
 * provider it connected and the model asked, or null for both when it
 * chose none, and its text or images then come from the server's model,
 * when `serverModel` says it has one, or from nobody.
 */
export const AiCapabilityModelSchema = Schema.Struct({
  capability: AiCapabilitySchema,
  model: Schema.NullOr(Schema.String),
  provider: Schema.NullOr(AiProviderIdSchema),
  // Whether the server's operator set up a model of their own for this
  // use, which works for the workspace while it chooses none.
  serverModel: Schema.Boolean,
  // When the choice was saved; null while there is none.
  updatedAt: Schema.NullOr(Schema.DateTimeUtc),
}).annotate({ identifier: "AiCapabilityModel" });

export type AiCapabilityModel = typeof AiCapabilityModelSchema.Type;

/** Every use, chosen or not, in the order `AiCapability` lists them. */
export const AiCapabilityModelsSchema = Schema.Struct({
  models: Schema.Array(AiCapabilityModelSchema),
}).annotate({ identifier: "AiCapabilityModels" });

export type AiCapabilityModels = typeof AiCapabilityModelsSchema.Type;

const providerModelSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maxImageProviderModelLength),
  Schema.isPattern(imageProviderModelPattern, {
    expected: "a model's name on one line, without control characters",
  })
);

export const AiCapabilityModelChangeSchema = Schema.Struct({
  // The model the provider is asked for, one line. Every use needs one
  // (AiModelRequired otherwise) but `composition`, which takes none: its
  // model is `edit`, Shotstack's Edit API, whatever is sent.
  model: Schema.optionalKey(providerModelSchema),
  // A provider the workspace connected that offers this use.
  provider: AiProviderIdSchema,
}).annotate({ identifier: "AiCapabilityModelChange" });

export type AiCapabilityModelChange = typeof AiCapabilityModelChangeSchema.Type;

export const AiProviderTestSchema = Schema.Struct({
  // The model to ask. Left out, the one the workspace's text is written
  // with when this provider writes it, else the first Peal suggests.
  model: Schema.optionalKey(providerModelSchema),
}).annotate({ identifier: "AiProviderTest" });

export type AiProviderTest = typeof AiProviderTestSchema.Type;

const providerParams = { provider: AiProviderIdSchema };

const capabilityParams = { capability: AiCapabilitySchema };

// The day the text and image provider endpoints gave way to connected
// providers and a model for each use.
const providersSince = deprecated({ since: "2026-11-23T00:00:00Z" });

const configureNote =
  "Needs assistant:configure, which no OAuth client holds but Peal's command line.";

const textProviderDescription =
  "Anthropic's Messages API or an endpoint that speaks the OpenAI chat completions API, whose suggestions then spend none of the workspace's daily assistant requests";

const imageProviderDescription =
  "a provider Peal knows by name (OpenAI, Google Gemini, xAI, Together AI) or an endpoint that speaks the OpenAI images API (`POST {baseUrl}/images/generations`), whose images then spend none of the workspace's daily assistant requests";

/**
 * The writing assistant: suggestions on a post's text from the text
 * provider the workspace brought or else the language model the server is
 * configured with, and images, kept in the media
 * library, from the image provider the workspace brought or else the
 * server's image model. Nothing of a suggestion is saved; the person
 * accepts it or discards it. Each workspace sends a limited number of
 * requests per UTC day, an image of the server's model costing several.
 */
export class AssistantApi extends HttpApiGroup.make("assistant")
  .add(
    HttpApiEndpoint.get("status", "/", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: AssistantStatusSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Tells whether the assistant writes for the workspace, so clients show it or hide it, and who writes (`source`: the workspace's own text provider, the server's language model, or nobody), who makes the workspace's images (`images.source`: the workspace's own provider, the server's image model, or nobody) and what one costs, and how many requests the workspace has left today. On a server that bills, `month` and `images.month` tell the billing account's month of the server's models (included, used, price and ceiling), and `reason` `paymentMethod` why they are off without a payment method. Needs assistant:use.",
        summary: "Get the assistant's status",
      })
    ),
    HttpApiEndpoint.post("suggest", "/suggestions", {
      error: [
        Forbidden,
        AssistantUnavailable,
        AssistantInputRejected,
        AssistantQuotaExceeded,
        UsageAllowanceReached,
        AssistantFailed,
        TextProviderRefused,
        OwnTextLimitReached,
        TextProviderBusy,
      ],
      headers: workspaceHeaders,

      payload: SuggestionRequestSchema,
      success: SuggestionSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Asks the language model to rewrite, shorten or translate a post's text, to suggest hashtags for it, or to write a first post from a subject (`write`), and answers once the whole suggestion is checked. The text is sent to the model as data, never as instructions. When the workspace brought its own text provider (`source` `workspace` in the status), the text goes there, with the workspace's key, and the request costs none of the workspace's daily requests, on any plan, within a number of such requests a day (OwnTextLimitReached past it) and a few at once (TextProviderBusy past them); if that provider refuses, the answer is TextProviderRefused and the server's model is never asked instead. Otherwise, on a server that does not bill, each request counts toward the workspace's daily quota, unless the model's provider could not be reached (AssistantQuotaExceeded past it). On a server that bills, the server's model needs a payment method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is asked): each request counts toward the month's allowance across the account's workspaces (the status's `month`), then is billed at its price up to the ceiling the account set (UsageAllowanceReached `ceilingReached`); a request that brings no suggestion, a timeout included, is not counted. Needs assistant:use.",
        summary: "Suggest a change to a post's text",
      })
    ),
    HttpApiEndpoint.post("generateImage", "/images", {
      error: [
        Forbidden,
        AssistantUnavailable,
        AssistantInputRejected,
        AssistantQuotaExceeded,
        UsageAllowanceReached,
        AssistantFailed,
        ImageProviderRefused,
        OwnImageLimitReached,
        PlanLimitReached,
        MediaStoreUnavailable,
        MediaImportBusy,
      ],
      headers: workspaceHeaders,

      payload: ImageRequestSchema,
      success: MediaSchema.pipe(HttpApiSchema.status(201)),
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Asks for one image from the prompt, in the aspect asked for, and answers with it as a new file of the media library, ready to attach, marked `aiGenerated` and without a description. When the workspace brought its own image provider, the prompt goes there, with the workspace's key, and the image costs none of the workspace's daily requests, on any plan, a trial and the free plan included, within a number of such images a day (OwnImageLimitReached past it); if that provider refuses, the answer is ImageProviderRefused and the server's model is never asked instead. Otherwise the prompt goes to the image provider the server's operator chose. On a server that does not bill, an image costs the status's `images.requestCost` of the workspace's daily requests, given back only when the provider could not be reached. On a server that bills, it needs a payment method on the billing account (UsageAllowanceReached `paymentMethodRequired` without one, before anything is asked) and counts one of the month's images (`images.month`), billed past the allowance up to the account's ceiling (UsageAllowanceReached `ceilingReached`); an image that is not stored, whatever the reason, is not counted. Neither the prompt nor the image is logged. Either way the image takes room in the plan's media storage, which must hold the largest image before anything is asked. The file is stored as the provider gave it. Peal sets no platform's AI label on its own: set it in the post's options (YouTube `containsSyntheticMedia`, TikTok `aiGenerated`, X `madeWithAi`). Needs assistant:use and media:upload. Off unless the workspace brought a provider or the server has an image model (`images.source`).",
        summary: "Make an image into the media library",
      })
    ),
    HttpApiEndpoint.get("imageProvider", "/image-provider", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: ImageProviderSettingSchema,
    })
      .annotateMerge(
        OpenApi.annotations({
          description: `Reads the image provider the workspace brought, ${imageProviderDescription}: its address and model, never its key, or null. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).`,
          summary: "Get the workspace's image provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.put("setImageProvider", "/image-provider", {
      error: [
        Forbidden,
        ImageProviderAddressRefused,
        ImageProviderKeyRequired,
        AssistantSecretsNotConfigured,
      ],
      headers: workspaceHeaders,

      payload: ImageProviderChangeSchema,
      success: ImageProviderSchema,
    })
      .annotateMerge(
        OpenApi.annotations({
          description: `Sets the image provider the workspace brings, ${imageProviderDescription}. The workspace's image prompts then go to \`baseUrl\` (the provider's own address when left out) with \`apiKey\`, through the API \`provider\` names (\`openai-compatible\` when left out); the images still take room in the plan's media storage. Peal keeps the key encrypted for this workspace and this address, never shows it again, and never sends it to another address: \`apiKey\` may be left out to keep the stored one only while \`baseUrl\` stays exactly the same (to change the model alone). The address must be public HTTPS; it is checked now, and before every call. The provider is not called: the first image tells whether the settings work. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).`,
          summary: "Set the workspace's image provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.delete("removeImageProvider", "/image-provider", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: HttpApiSchema.NoContent,
    })
      .annotateMerge(
        OpenApi.annotations({
          description:
            "Removes the workspace's image provider and its key: images are made by the server's image model again, if it has one, and cost the workspace's daily requests. Needs assistant:configure, which no OAuth client holds but Peal's command line (since 2026-11-13; before, any client with workspace:write did).",
          summary: "Remove the workspace's image provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.get("textProvider", "/text-provider", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: TextProviderSettingSchema,
    })
      .annotateMerge(
        OpenApi.annotations({
          description: `Reads the text provider the workspace brought, ${textProviderDescription}: the API it speaks, its address and model, never its key, or null. Needs assistant:configure.`,
          summary: "Get the workspace's text provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.put("setTextProvider", "/text-provider", {
      error: [
        Forbidden,
        TextProviderAddressRefused,
        TextProviderKeyRequired,
        AssistantSecretsNotConfigured,
        AiCapabilityNotOffered,
      ],
      headers: workspaceHeaders,

      payload: TextProviderChangeSchema,
      success: TextProviderSchema,
    })
      .annotateMerge(
        OpenApi.annotations({
          description: `Sets the text provider the workspace brings, ${textProviderDescription}. The workspace's drafts, and the subjects of the posts it asks the assistant to write, then go to \`baseUrl\` with \`apiKey\`, under that provider's terms. Peal keeps the key encrypted for this workspace and this address, never shows it again, and never sends it to another address: \`apiKey\` may be left out to keep the stored one only while \`baseUrl\` stays exactly the same (to change the model alone). The address must be public HTTPS; it is checked now, and before every call. A provider that writes no text (ElevenLabs, fal) is AiCapabilityNotOffered. The provider is not called: test it with \`POST .../text-provider/test\`. Needs assistant:configure, which no OAuth client holds but Peal's command line.`,
          summary: "Set the workspace's text provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.delete("removeTextProvider", "/text-provider", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: HttpApiSchema.NoContent,
    })
      .annotateMerge(
        OpenApi.annotations({
          description:
            "Removes the workspace's text provider and its key: the server's language model writes again, if it has one, within the workspace's daily requests. Needs assistant:configure.",
          summary: "Remove the workspace's text provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.post("testTextProvider", "/text-provider/test", {
      error: [
        Forbidden,
        TextProviderNotFound,
        TextProviderRefused,
        OwnTextLimitReached,
        TextProviderBusy,
        AssistantFailed,
      ],
      headers: workspaceHeaders,

      success: HttpApiSchema.NoContent,
    })
      .annotateMerge(
        OpenApi.annotations({
          description:
            "Sends the workspace's text provider one short request, a rewrite of a fixed sentence, as a member's request would go, and answers 204 once the provider gave a suggestion the assistant can use. Otherwise the answer says why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its address or its key) or AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use: often a model without structured output). It counts as one of the day's requests to that provider, and nothing of Peal's. Needs assistant:configure.",
          summary: "Test the workspace's text provider",
        })
      )
      .annotateMerge(providersSince),
    HttpApiEndpoint.get("providers", "/providers", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: AiProviderConnectionsSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Lists the AI providers the workspace connected with a key of its own: where each is reached, never its key. What it uses each for is \`GET .../assistant/models\`'s to say. ${configureNote}`,
        summary: "List the workspace's AI providers",
      })
    ),
    HttpApiEndpoint.put("connectProvider", "/providers/:provider", {
      error: [
        Forbidden,
        AiProviderAddressRefused,
        AiProviderKeyRequired,
        AssistantSecretsNotConfigured,
      ],
      headers: workspaceHeaders,
      params: providerParams,
      payload: AiProviderConnectionChangeSchema,
      success: AiProviderConnectionSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Connects a provider of Peal's catalogue (\`peal-contract/ai-providers\`), or \`openai-compatible\`, any endpoint of the OpenAI chat completions and images APIs, with the workspace's own key, or changes its address or key. It is then offered for each use it serves (\`PUT .../assistant/models/{capability}\`), whose requests spend none of Peal's allowance. Peal keeps the key encrypted for this workspace, this provider and this address, never shows it again, and never sends it to another address: \`apiKey\` may be left out to keep the stored one only while \`baseUrl\` stays exactly the same. The address must be public HTTPS; it is checked now, and before every call. A provider reached at its own address alone (\`fixedAddress\`: ElevenLabs, fal, Shotstack) takes no other (AiProviderAddressRefused \`fixedAddress\`): Shotstack takes its production API (\`https://api.shotstack.io/edit/v1\`, the default) or its sandbox (\`https://api.shotstack.io/edit/stage\`, free and watermarked), each with its own key. The provider is not called: test it with \`POST .../providers/{provider}/test\`. ${configureNote}`,
        summary: "Connect an AI provider",
      })
    ),
    HttpApiEndpoint.delete("disconnectProvider", "/providers/:provider", {
      error: Forbidden,
      headers: workspaceHeaders,
      params: providerParams,
      success: HttpApiSchema.NoContent,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Removes the provider and its key, and the uses it served: the server's model works for them again, if it has one, within the workspace's allowance. Answers 204 whether or not the provider was connected. ${configureNote}`,
        summary: "Disconnect an AI provider",
      })
    ),
    HttpApiEndpoint.post("testProvider", "/providers/:provider/test", {
      error: [
        Forbidden,
        AiProviderNotConnected,
        AiCapabilityNotOffered,
        AiModelRequired,
        TextProviderRefused,
        OwnTextLimitReached,
        TextProviderBusy,
        AssistantFailed,
      ],
      headers: workspaceHeaders,
      params: providerParams,
      payload: AiProviderTestSchema,
      success: HttpApiSchema.NoContent,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Sends a connected provider one short request for text, a rewrite of a fixed sentence, as a member's request would go, with \`model\` (left out, the model the workspace's text is written with when this provider writes it, else the first Peal suggests for it), and answers 204 once the provider gave a suggestion the assistant can use. Otherwise the answer says why, as a suggestion's would: TextProviderRefused (its settings, a redirect, its address or its key) or AssistantFailed (unreachable, timed out, declined, or an answer the assistant cannot use: often a model without structured output). It counts as one of the day's requests to the workspace's own providers, and nothing of Peal's. ${configureNote}`,
        summary: "Test an AI provider",
      })
    ),
    HttpApiEndpoint.get("models", "/models", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: AiCapabilityModelsSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Tells, for each use (text, images, videos, voice-overs, transcripts, slide videos), the connected provider and the model the workspace chose, or none, and whether the server has a model of its own that works meanwhile. ${configureNote}`,
        summary: "List the workspace's models",
      })
    ),
    HttpApiEndpoint.put("setModel", "/models/:capability", {
      error: [
        Forbidden,
        AiProviderNotConnected,
        AiCapabilityNotOffered,
        AiModelRequired,
      ],
      headers: workspaceHeaders,
      params: capabilityParams,
      payload: AiCapabilityModelChangeSchema,
      success: AiCapabilityModelSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Chooses the provider and the model for one use: the provider must be connected (AiProviderNotConnected otherwise) and offer the use (AiCapabilityNotOffered otherwise), and \`model\` is required (AiModelRequired) but for \`composition\`, whose model is always \`edit\`. The workspace's drafts or prompts for that use then go to it, with the workspace's key, and spend none of Peal's allowance, within a number of such requests a day. The model is not checked: test the provider, or make a first request. ${configureNote}`,
        summary: "Choose a model for a use",
      })
    ),
    HttpApiEndpoint.delete("unsetModel", "/models/:capability", {
      error: Forbidden,
      headers: workspaceHeaders,
      params: capabilityParams,
      success: HttpApiSchema.NoContent,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Leaves a use to the server's model, if it has one (\`serverModel\`), within the workspace's allowance, or off; the provider stays connected. ${configureNote}`,
        summary: "Unset a use's model",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/assistant") {}
