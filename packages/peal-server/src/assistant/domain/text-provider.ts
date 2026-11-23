import { Schema } from "effect";

import {
  ProviderAddressSchema,
  ProviderModelSchema,
} from "./image-provider.ts";

/**
 * The API a workspace's text provider speaks, as `PEAL_AI_PROVIDER` names
 * the server's: Anthropic's Messages API (`POST {base}/v1/messages`), or
 * an OpenAI-compatible endpoint (`POST {base}/chat/completions`).
 */
export const TextProviderKindSchema = Schema.Literals([
  "anthropic",
  "openai-compatible",
]);

export type TextProviderKind = typeof TextProviderKindSchema.Type;

/**
 * The providers Peal knows by name (`peal-contract/ai-providers`, kept
 * equal by `test/assistant/api/contract.test.ts`): each has an adapter of
 * its own, or is any endpoint serving chat completions with a strict JSON
 * schema (`openai-compatible`).
 */
export const TextProviderIdSchema = Schema.Literals([
  "anthropic",
  "openai",
  "google",
  "mistral",
  "xai",
  "groq",
  "togetherai",
  "deepseek",
  "openrouter",
  "cerebras",
  "fireworks",
  "openai-compatible",
]);

export type TextProviderId = typeof TextProviderIdSchema.Type;

/** The API a provider speaks: the Messages API for Anthropic, chat completions for the others. */
export const kindOfProvider = (provider: TextProviderId): TextProviderKind =>
  provider === "anthropic" ? "anthropic" : "openai-compatible";

/** The provider a row saved before providers had names stands for. */
export const providerOfKind = (kind: TextProviderKind): TextProviderId => kind;

/**
 * Where each provider's API is reached when no address is given (for
 * Anthropic, the one `/v1/messages` follows; for the others, the one
 * `/chat/completions` follows), as the contract's catalogue offers it;
 * `openai-compatible` has none.
 */
export const providerAddresses: Readonly<
  Record<TextProviderId, string | null>
> = {
  anthropic: "https://api.anthropic.com",
  cerebras: "https://api.cerebras.ai/v1",
  deepseek: "https://api.deepseek.com",
  fireworks: "https://api.fireworks.ai/inference/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  openai: "https://api.openai.com/v1",
  "openai-compatible": null,
  openrouter: "https://openrouter.ai/api/v1",
  togetherai: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1",
};

/**
 * Where Anthropic's API is reached, which its paths (`/v1/messages`)
 * follow: what clients offer for an `anthropic` provider.
 */
export const anthropicAddress = "https://api.anthropic.com";

/**
 * How many requests a workspace may send its own text provider each UTC
 * day, whatever each ends with: none of them is Peal's, so this bounds
 * only the workspace's hold on the server (a request may wait 90 seconds
 * for an answer), not what it costs.
 */
export const ownTextRequestsPerDay = 500;

/**
 * How many requests to workspaces' own text providers run at once: so
 * many a workspace, and so many on a server in all. Each may wait 90
 * seconds at an endpoint the workspace chose, which may never answer, so
 * the day's bound alone would let one workspace hold hundreds together.
 */
export const ownTextAtOnce = { perServer: 32, perWorkspace: 4 } as const;

/**
 * The settings of the text provider a workspace brought: the API it
 * speaks, its address, its model and when they were saved. Its key is
 * kept apart, sealed, and never part of them.
 */
export class TextProviderSettings extends Schema.Class<TextProviderSettings>(
  "peal-server/assistant/domain/TextProviderSettings"
)({
  baseUrl: ProviderAddressSchema,
  kind: TextProviderKindSchema,
  model: ProviderModelSchema,
  provider: TextProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}) {}
