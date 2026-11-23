import { Effect, Option } from "effect";

import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import type {
  SpeechEndpoint,
  TranscriptionEndpoint,
} from "#assistant/application/ports/own-audio-model.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import {
  asSpeechProvider,
  asTranscriptionProvider,
  capabilityAddressOf,
} from "#assistant/domain/ai-capability.ts";
import type { ConnectedProviderId } from "#assistant/domain/ai-capability.ts";
import type {
  SpeechProviderId,
  TranscriptionProviderId,
} from "#assistant/domain/audio-provider.ts";
import type { AudioCapability } from "#assistant/domain/audio-use.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * The workspace's choice for an audio use, opened: `notSet` when it chose
 * none (or a provider this release offers nothing of the use with),
 * `keyUnreadable` when the chosen provider's key no longer opens, else
 * the endpoint to call.
 */
export type OpenedAudioUse<Provider, Endpoint> =
  | { readonly _tag: "notSet" }
  | { readonly _tag: "keyUnreadable"; readonly provider: Provider }
  | { readonly _tag: "open"; readonly endpoint: Endpoint };

// Where a provider of an audio use is, with its key and model.
interface AudioEndpoint<Provider> {
  readonly apiKey: SpeechEndpoint["apiKey"];
  readonly baseUrl: SpeechEndpoint["baseUrl"];
  readonly model: string;
  readonly provider: Provider;
}

const openWith = <Provider extends ConnectedProviderId>(
  workspaceId: WorkspaceId,
  capability: AudioCapability,
  narrow: (provider: ConnectedProviderId) => Provider | null
) =>
  Effect.gen(function* openingAudioUse() {
    type Opened = OpenedAudioUse<Provider, AudioEndpoint<Provider>>;

    const notSet: Opened = { _tag: "notSet" };

    const chosen = (yield* CapabilityModels.use((models) =>
      models.list(workspaceId)
    )).find((each) => each.capability === capability);

    const provider = chosen === undefined ? null : narrow(chosen.provider);

    if (chosen === undefined || provider === null) {
      return notSet;
    }

    const connection = yield* ProviderConnections.use((connections) =>
      connections.open(workspaceId, provider)
    );

    if (Option.isNone(connection)) {
      return notSet;
    }

    const { apiKey, settings } = connection.value;

    const opened: Opened = Option.match(apiKey, {
      onNone: () => ({ _tag: "keyUnreadable", provider }),
      onSome: (key) => ({
        _tag: "open",
        endpoint: {
          apiKey: key,
          baseUrl: ProviderAddressSchema.make(
            capabilityAddressOf(provider, capability, settings.baseUrl)
          ),
          model: chosen.model,
          provider,
        },
      }),
    });

    return opened;
  });

/** The workspace's choice for voice-overs, opened. */
export const openSpeechUse = (
  workspaceId: WorkspaceId
): Effect.Effect<
  OpenedAudioUse<SpeechProviderId, SpeechEndpoint>,
  never,
  CapabilityModels | ProviderConnections
> => openWith(workspaceId, "speech", asSpeechProvider);

/** The workspace's choice for transcripts, opened. */
export const openTranscriptionUse = (
  workspaceId: WorkspaceId
): Effect.Effect<
  OpenedAudioUse<TranscriptionProviderId, TranscriptionEndpoint>,
  never,
  CapabilityModels | ProviderConnections
> => openWith(workspaceId, "transcription", asTranscriptionProvider);
