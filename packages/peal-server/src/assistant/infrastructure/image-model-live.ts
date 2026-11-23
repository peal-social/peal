import { Effect, Layer } from "effect";

import { imageProviderConfig } from "#assistant/infrastructure/assistant-settings.ts";
import type { ImageProvider } from "#assistant/infrastructure/assistant-settings.ts";
import { aiSdkImageModel } from "#assistant/infrastructure/sdk-image-model.ts";
import { UnavailableImageModelLive } from "#assistant/infrastructure/unavailable-image-model.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";

/**
 * The ImageModel for a provider's settings. An address a provider answers
 * with goes through the OutboundGuard, which resolves names with the
 * runtime's Dns.
 */
export const imageModelFor = (provider: ImageProvider) =>
  provider._tag === "Off"
    ? UnavailableImageModelLive
    : aiSdkImageModel(provider).pipe(Layer.provide(OutboundGuard.layer));

/** The image model the environment names, or none (see assistant-settings.ts). */
export const ImageModelLive = Layer.unwrap(
  imageProviderConfig.pipe(Effect.map(imageModelFor))
);
