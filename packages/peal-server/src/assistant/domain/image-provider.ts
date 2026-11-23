import { Result, Schema } from "effect";

import type { ImageAspect } from "./image-aspect.ts";
import { ProviderAddressRejected } from "./provider-address-rejected.ts";
import { ProviderSettingRejected } from "./provider-setting-rejected.ts";

/** The longest address of a workspace's image provider, as `URL.href` writes it. */
export const maxProviderAddressLength = 2048;

/** The longest model name a workspace's image provider is asked for. */
export const maxProviderModelLength = 200;

/** The longest key of a workspace's image provider. */
export const maxProviderKeyLength = 500;

/**
 * Where a workspace's image provider is reached: an absolute HTTPS address
 * on the default port, without a user, a password, a query or a
 * fragment, and without the slashes that end it, so the API's paths
 * (`/images/generations`) follow it. Whether its host is public is the
 * outbound guard's to say, when it is saved and before every call.
 */
export const ProviderAddressSchema = Schema.NonEmptyString.pipe(
  Schema.brand("ProviderAddress")
);

export type ProviderAddress = typeof ProviderAddressSchema.Type;

/** The model the provider is asked for: one line, as the workspace wrote it. */
export const ProviderModelSchema = Schema.NonEmptyString.check(
  Schema.isMaxLength(maxProviderModelLength)
).pipe(Schema.brand("ProviderModel"));

export type ProviderModel = typeof ProviderModelSchema.Type;

/**
 * The providers Peal makes images with (`aiImageProviders` in
 * `peal-contract/ai-providers`, kept equal by
 * `test/assistant/api/contract.test.ts`): each has an adapter of its own,
 * or is any endpoint serving `/images/generations` (`openai-compatible`).
 */
export const ImageProviderIdSchema = Schema.Literals([
  "openai",
  "google",
  "xai",
  "togetherai",
  "openai-compatible",
  "fal",
]);

export type ImageProviderId = typeof ImageProviderIdSchema.Type;

/**
 * Where each provider's images API is reached when no address is given,
 * as the contract's catalogue offers it; `openai-compatible` has none.
 */
export const imageProviderAddresses: Readonly<
  Record<ImageProviderId, string | null>
> = {
  fal: "https://fal.run",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openai: "https://api.openai.com/v1",
  "openai-compatible": null,
  togetherai: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1",
};

/** How an image's dimensions are asked for: in pixels, or as a ratio. */
export type ImageDimensions =
  | { readonly size: `${number}x${number}` }
  | { readonly aspectRatio: `${number}:${number}` };

// Width by height, as the OpenAI images API and those that speak it take
// them: the sizes current models make.
const pixelSizes: Readonly<Record<ImageAspect, ImageDimensions>> = {
  landscape: { size: "1536x1024" },
  portrait: { size: "1024x1536" },
  square: { size: "1024x1024" },
};

// The same dimensions as ratios, for an API that takes no size.
const ratios: Readonly<Record<ImageAspect, ImageDimensions>> = {
  landscape: { aspectRatio: "3:2" },
  portrait: { aspectRatio: "2:3" },
  square: { aspectRatio: "1:1" },
};

// fal's FLUX models: its package turns these ratios into its own sizes
// (`landscape_4_3`, `portrait_4_3`, `square_hd`).
const falRatios: Readonly<Record<ImageAspect, ImageDimensions>> = {
  landscape: { aspectRatio: "4:3" },
  portrait: { aspectRatio: "3:4" },
  square: { aspectRatio: "1:1" },
};

/**
 * How each provider is asked for each of Peal's aspects, as the
 * contract's catalogue says: Gemini and xAI take ratios alone, the others
 * sizes.
 */
export const imageDimensionsByProvider: Readonly<
  Record<ImageProviderId, Readonly<Record<ImageAspect, ImageDimensions>>>
> = {
  fal: falRatios,
  google: ratios,
  openai: pixelSizes,
  "openai-compatible": pixelSizes,
  togetherai: pixelSizes,
  xai: ratios,
};

/** The dimensions a provider is asked for, for an image of this aspect. */
export const imageDimensionsOf = (
  provider: ImageProviderId,
  aspect: ImageAspect
): ImageDimensions => imageDimensionsByProvider[provider][aspect];

/**
 * The settings of the image provider a workspace brought: the provider,
 * its address, its model and when they were saved. Its key is kept apart,
 * sealed, and never part of them.
 */
export class ImageProviderSettings extends Schema.Class<ImageProviderSettings>(
  "peal-server/assistant/domain/ImageProviderSettings"
)({
  baseUrl: ProviderAddressSchema,
  model: ProviderModelSchema,
  provider: ImageProviderIdSchema,
  updatedAt: Schema.DateTimeUtc,
}) {}

const refused = (reason: ProviderAddressRejected["reason"]) =>
  Result.fail(new ProviderAddressRejected({ reason }));

/**
 * The address as a workspace's provider keeps it, or why it is refused:
 * HTTPS on the default port only, which is all the outbound guard lets a
 * request reach.
 */
export const checkProviderAddress = (
  text: string
): Result.Result<ProviderAddress, ProviderAddressRejected> => {
  const url = URL.parse(text.trim());

  if (url === null) {
    return refused("malformed");
  }

  if (url.protocol !== "https:" || url.port !== "") {
    return refused("notHttps");
  }

  if (url.host === "") {
    return refused("malformed");
  }

  if (url.href.length > maxProviderAddressLength) {
    return refused("tooLong");
  }

  if (url.username !== "" || url.password !== "") {
    return refused("credentials");
  }

  // A path writes `?` and `#` encoded: either one here starts a query or a
  // fragment, an empty one included.
  if (url.href.includes("?") || url.href.includes("#")) {
    return refused("queryOrFragment");
  }

  return Result.succeed(
    ProviderAddressSchema.make(url.href.replace(/\/+$/u, ""))
  );
};

/**
 * What a model name may hold: one line, without control or format
 * characters (the marks that reorder text among them), lone surrogates or
 * line separators, and not blank: what `storableLine` would not change but
 * for its spaces. The contract copies it.
 */
export const providerModelPattern =
  /^(?=.*\S)[^\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]+$/u;

/**
 * The model as the provider is asked for it: one line of 1 to
 * `maxProviderModelLength` characters, as `providerModelPattern` says,
 * without the spaces around it.
 */
export const checkProviderModel = (
  text: string
): Result.Result<ProviderModel, ProviderSettingRejected> => {
  const model = text.trim();

  return model.length <= maxProviderModelLength &&
    providerModelPattern.test(model)
    ? Result.succeed(ProviderModelSchema.make(model))
    : Result.fail(new ProviderSettingRejected({ field: "model" }));
};

/** What a key may hold: visible ASCII, as an HTTP header does. */
export const providerKeyPattern = /^[!-~]+$/u;

/** The key as it is sent: 1 to `maxProviderKeyLength` visible characters. */
export const checkProviderKey = (
  text: string
): Result.Result<string, ProviderSettingRejected> =>
  text.length <= maxProviderKeyLength && providerKeyPattern.test(text)
    ? Result.succeed(text)
    : Result.fail(new ProviderSettingRejected({ field: "apiKey" }));
