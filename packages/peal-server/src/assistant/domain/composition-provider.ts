import { Schema } from "effect";

/**
 * The services Peal composes slide videos with (`aiCompositionProviders`
 * in `peal-contract/ai-providers`, kept equal by
 * `test/assistant/api/contract.test.ts`), each with an adapter of its own
 * outside the AI SDK, which composes nothing.
 */
export const CompositionProviderIdSchema = Schema.Literals(["shotstack"]);

export type CompositionProviderId = typeof CompositionProviderIdSchema.Type;

/**
 * Where a service is reached: its production API, which renders with the
 * account's credits and no watermark, and its sandbox, free and always
 * watermarked, which answers the account's sandbox key.
 */
export interface CompositionOffer {
  readonly baseUrl: string;
  readonly sandboxUrl: string;
}

/** Each service's addresses, as the contract's catalogue states them. */
export const compositionOffers: Readonly<
  Record<CompositionProviderId, CompositionOffer>
> = {
  shotstack: {
    baseUrl: "https://api.shotstack.io/edit/v1",
    sandboxUrl: "https://api.shotstack.io/edit/stage",
  },
};

/**
 * The model a composition is stored with: it takes none, and `edit` names
 * Shotstack's Edit API, the one it renders with.
 */
export const compositionModel = "edit";

/** Whether a connection's address is the service's sandbox. */
export const isSandboxAddress = (
  provider: CompositionProviderId,
  address: string
): boolean => address === compositionOffers[provider].sandboxUrl;
