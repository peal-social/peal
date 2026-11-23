import { DateTime, Effect, Option, Redacted } from "effect";

import { ImageProviderKeyRequired } from "#assistant/application/image-provider-key-required.ts";
import { ImageProviders } from "#assistant/application/ports/image-providers.ts";
import type { StoredImageProvider } from "#assistant/application/ports/image-providers.ts";
import { ProviderAddressCheck } from "#assistant/application/ports/provider-address-check.ts";
import {
  checkProviderKey,
  checkProviderModel,
  imageProviderAddresses,
  ImageProviderSettings,
} from "#assistant/domain/image-provider.ts";
import type {
  ImageProviderId,
  ProviderAddress,
  ProviderModel,
} from "#assistant/domain/image-provider.ts";
import type { Actor } from "#shared/domain/access.ts";

/** A workspace's provider as its members read it: never its key. */
export interface ImageProviderView {
  readonly baseUrl: ProviderAddress;
  /** A key is stored; it is never shown again. */
  readonly keySet: true;
  /** The stored key no longer decrypts: type it again. */
  readonly keyUnreadable: boolean;
  readonly model: ProviderModel;
  readonly provider: ImageProviderId;
  readonly updatedAt: DateTime.Utc;
}

/**
 * What a member saves: the provider, the address and the model, and the
 * key if typed.
 */
export interface ImageProviderChange {
  /** Left out, the stored key is kept, when the address stays the same. */
  readonly apiKey?: string;
  /** Left out, the provider's own address; `openai-compatible` has none. */
  readonly baseUrl?: string;
  readonly model: string;
  /** Left out, `openai-compatible`. */
  readonly provider?: ImageProviderId;
}

const viewOf = ({
  keyUnreadable,
  settings,
}: StoredImageProvider): ImageProviderView => ({
  baseUrl: settings.baseUrl,
  keySet: true,
  keyUnreadable,
  model: settings.model,
  provider: settings.provider,
  updatedAt: settings.updatedAt,
});

/** The actor's workspace's provider, without its key; none when it has none. */
export const viewImageProvider = Effect.fn("ImageProviderSettings.view")(
  function* viewImageProvider(actor: Actor) {
    const stored = yield* ImageProviders.use((providers) =>
      providers.find(actor.workspaceId)
    );

    return stored.pipe(Option.map(viewOf));
  }
);

/**
 * Saves the workspace's provider: the address checked (the domain's rules,
 * then the outbound guard, once now), the model one line, and the key,
 * required unless the workspace has one stored that opens and the address
 * stays exactly the same, in which case it is kept, sealed again for that
 * address: a key never follows a changed path or host. The provider is not called: the first image tells whether the
 * settings work.
 */
export const saveImageProvider = Effect.fn("ImageProviderSettings.save")(
  function* saveImageProvider(actor: Actor, change: ImageProviderChange) {
    const { workspaceId } = actor;
    const providers = yield* ImageProviders;
    const provider = change.provider ?? "openai-compatible";

    // An address left out is the provider's own; one without any is
    // refused as malformed.
    const baseUrl = yield* ProviderAddressCheck.use((addresses) =>
      addresses.check(change.baseUrl ?? imageProviderAddresses[provider] ?? "")
    );

    const model = yield* Effect.fromResult(checkProviderModel(change.model));

    const key =
      change.apiKey === undefined
        ? yield* providers.open(workspaceId).pipe(
            Effect.map((stored) =>
              stored.pipe(
                Option.filter(({ settings }) => settings.baseUrl === baseUrl),
                Option.flatMap(({ apiKey }) => apiKey)
              )
            ),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new ImageProviderKeyRequired()),
                onSome: Effect.succeed,
              })
            )
          )
        : Redacted.make(
            yield* Effect.fromResult(checkProviderKey(change.apiKey))
          );

    const settings = new ImageProviderSettings({
      baseUrl,
      model,
      provider,
      updatedAt: yield* DateTime.now,
    });

    yield* providers.save(workspaceId, settings, key);

    const view: ImageProviderView = viewOf({ keyUnreadable: false, settings });

    return view;
  }
);

/**
 * Removes the workspace's provider and its key: its images are made by the
 * server's model again, if it has one.
 */
export const removeImageProvider = Effect.fn("ImageProviderSettings.remove")(
  function* removeImageProvider(actor: Actor) {
    yield* ImageProviders.use((providers) =>
      providers.remove(actor.workspaceId)
    );
  }
);
