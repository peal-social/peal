import { Context, DateTime, Effect, Layer, Option } from "effect";

import { AudioExhausted } from "#assistant/application/audio-exhausted.ts";
import type { AudioFailed } from "#assistant/application/audio-failed.ts";
import type { AudioMediaNotFound } from "#assistant/application/audio-media-not-found.ts";
import type { AudioNotStored } from "#assistant/application/audio-not-stored.ts";
import type { AudioNotTranscribable } from "#assistant/application/audio-not-transcribable.ts";
import { AudioUnavailable } from "#assistant/application/audio-unavailable.ts";
import {
  openSpeechUse,
  openTranscriptionUse,
} from "#assistant/application/audio-uses.ts";
import type { OpenedAudioUse } from "#assistant/application/audio-uses.ts";
import { AudioLibrary } from "#assistant/application/ports/audio-library.ts";
import type { GeneratedAudio } from "#assistant/application/ports/audio-library.ts";
import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { OwnAudioCounts } from "#assistant/application/ports/own-audio-counts.ts";
import { OwnAudioModel } from "#assistant/application/ports/own-audio-model.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { VoiceNotOffered } from "#assistant/application/voice-not-offered.ts";
import {
  maxTranscriptionBytes,
  transcriptionsPerDay,
  voiceoversPerDay,
} from "#assistant/domain/audio-limits.ts";
import { speechOffers } from "#assistant/domain/audio-provider.ts";
import type {
  SpeechProviderId,
  TranscriptionProviderId,
} from "#assistant/domain/audio-provider.ts";
import { checkVoiceoverText } from "#assistant/domain/audio-use.ts";
import type { AudioCapability } from "#assistant/domain/audio-use.ts";
import type { DraftRejected } from "#assistant/domain/draft-rejected.ts";
import { remainingOf, usageWindowAt } from "#assistant/domain/usage-window.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/** What a member asks a voice-over of: the text, and a voice if named. */
export interface VoiceoverAsked {
  readonly text: string;
  readonly voice: string | null;
}

/** What a transcript answers. */
export interface TranscriptView {
  readonly descriptionSaved: boolean;
  readonly durationSeconds: number | null;
  readonly language: string | null;
  readonly text: string;
}

/** Whether the workspace makes an audio use, and how many are left today. */
export interface AudioStatus<Provider> {
  readonly available: boolean;
  readonly dailyLimit: number;
  readonly provider: Provider | null;
  readonly remaining: number;
}

export type VoiceoverFailure =
  | AudioExhausted
  | AudioFailed
  | AudioNotStored
  | AudioUnavailable
  | DraftRejected
  | MissingPermission
  | PlanLimitReached
  | VoiceNotOffered;

export type TranscribeFailure =
  | AudioExhausted
  | AudioFailed
  | AudioMediaNotFound
  | AudioNotStored
  | AudioNotTranscribable
  | AudioUnavailable
  | MissingPermission;

type AudioPorts =
  | AudioLibrary
  | CapabilityModels
  | OwnAudioCounts
  | OwnAudioModel
  | ProviderConnections;

// The provider chosen, whether or not its key opens.
const providerOf = <Provider, Endpoint extends { readonly provider: Provider }>(
  use: OpenedAudioUse<Provider, Endpoint>
): Provider | null => {
  if (use._tag === "open") {
    return use.endpoint.provider;
  }

  return use._tag === "keyUnreadable" ? use.provider : null;
};

// Staff acting as a member would spend the workspace's account at its
// provider: the member does it themselves.
const refuseImpersonation = (actor: Actor) =>
  actor.subject._tag === "user" && Option.isSome(actor.subject.impersonatedBy)
    ? Effect.fail(new MissingPermission({ permission: "assistant:configure" }))
    : Effect.void;

// Counts one of the day's for the use, or fails once the day holds them all.
const claimOne = (
  actor: Actor,
  capability: AudioCapability,
  dailyLimit: number
) =>
  Effect.gen(function* claimingOne() {
    const window = usageWindowAt(yield* DateTime.now);

    const claimed = yield* OwnAudioCounts.use((counts) =>
      counts.claim(actor.workspaceId, capability, window.day, dailyLimit)
    );

    yield* Option.isSome(claimed)
      ? Effect.void
      : Effect.fail(
          new AudioExhausted({
            capability,
            dailyLimit,
            resetsAt: window.resetsAt,
          })
        );
  });

const statusOf = <Provider, Endpoint extends { readonly provider: Provider }>(
  actor: Actor,
  capability: AudioCapability,
  dailyLimit: number,
  use: OpenedAudioUse<Provider, Endpoint>
) =>
  Effect.gen(function* audioStatus() {
    const window = usageWindowAt(yield* DateTime.now);

    const used = yield* OwnAudioCounts.use((counts) =>
      counts.countOn(actor.workspaceId, capability, window.day)
    );

    const status: AudioStatus<Provider> = {
      available: use._tag === "open",
      dailyLimit,
      provider: providerOf(use),
      remaining: remainingOf(dailyLimit, used),
    };

    return status;
  });

/**
 * Voice-overs and transcripts from the providers the workspace chose for
 * them, with its own keys: Peal sends the request, waits, and keeps the
 * result (the audio in the media library; the transcript, when asked, as
 * the file's description). Voice-overs need assistant:use and
 * media:upload, transcripts assistant:use and media:read (and media:upload
 * to save a description), the status assistant:use; staff acting as a
 * member ask for none, as the workspace's account at its provider pays.
 * Nothing of Peal's allowance is read or counted: each use is bounded by
 * a number a workspace and UTC day, counted before the provider is asked,
 * whatever it ends with.
 */
export class AssistantAudio extends Context.Service<
  AssistantAudio,
  {
    readonly voiceover: (
      actor: Actor,
      asked: VoiceoverAsked
    ) => Effect.Effect<GeneratedAudio, VoiceoverFailure>;
    readonly transcribe: (
      actor: Actor,
      mediaId: string,
      options: { readonly saveAsDescription: boolean }
    ) => Effect.Effect<TranscriptView, TranscribeFailure>;
    readonly voiceoversStatus: (
      actor: Actor
    ) => Effect.Effect<AudioStatus<SpeechProviderId>, MissingPermission>;
    readonly transcriptionsStatus: (
      actor: Actor
    ) => Effect.Effect<AudioStatus<TranscriptionProviderId>, MissingPermission>;
  }
>()("peal-server/assistant/application/AssistantAudio") {
  static readonly layer = Layer.effect(
    AssistantAudio,
    Effect.gen(function* AssistantAudioLive() {
      const ports = yield* Effect.context<AudioPorts>();

      const voiceover = Effect.fn("AssistantAudio.voiceover")(
        function* voiceover(actor: Actor, asked: VoiceoverAsked) {
          yield* Effect.fromResult(authorize(actor, "assistant:use"));
          yield* Effect.fromResult(authorize(actor, "media:upload"));
          yield* refuseImpersonation(actor);

          const text = yield* Effect.fromResult(checkVoiceoverText(asked.text));
          const use = yield* openSpeechUse(actor.workspaceId);

          if (use._tag !== "open") {
            return yield* new AudioUnavailable({
              capability: "speech",
              reason: use._tag,
            });
          }

          const { endpoint } = use;

          if (
            asked.voice !== null &&
            !speechOffers[endpoint.provider].takesVoice
          ) {
            return yield* new VoiceNotOffered();
          }

          const library = yield* AudioLibrary;

          // The largest voice-over must fit before anything is asked.
          yield* library.roomFor(actor);
          yield* claimOne(actor, "speech", voiceoversPerDay);

          const spoken = yield* OwnAudioModel.use((model) =>
            model.speak(endpoint, {
              text,
              voice: Option.fromNullishOr(asked.voice),
            })
          );

          return yield* library.store(actor, spoken.bytes);
        }
      );

      const transcribe = Effect.fn("AssistantAudio.transcribe")(
        function* transcribe(
          actor: Actor,
          mediaId: string,
          { saveAsDescription }: { readonly saveAsDescription: boolean }
        ) {
          yield* Effect.fromResult(authorize(actor, "assistant:use"));
          yield* Effect.fromResult(authorize(actor, "media:read"));

          if (saveAsDescription) {
            yield* Effect.fromResult(authorize(actor, "media:upload"));
          }

          yield* refuseImpersonation(actor);

          const use = yield* openTranscriptionUse(actor.workspaceId);

          if (use._tag !== "open") {
            return yield* new AudioUnavailable({
              capability: "transcription",
              reason: use._tag,
            });
          }

          const library = yield* AudioLibrary;

          const audio = yield* library.read(
            actor,
            mediaId,
            maxTranscriptionBytes
          );

          yield* claimOne(actor, "transcription", transcriptionsPerDay);

          const transcript = yield* OwnAudioModel.use((model) =>
            model.transcribe(use.endpoint, audio)
          );

          const descriptionSaved =
            saveAsDescription && transcript.text.trim() !== ""
              ? yield* library.describe(actor, mediaId, transcript.text)
              : false;

          const view: TranscriptView = {
            descriptionSaved,
            durationSeconds: Option.getOrNull(transcript.durationSeconds),
            language: Option.getOrNull(transcript.language),
            text: transcript.text,
          };

          return view;
        }
      );

      const reading = <A, E>(
        actor: Actor,
        useCase: Effect.Effect<A, E, AudioPorts>
      ): Effect.Effect<A, E | MissingPermission> =>
        Effect.fromResult(authorize(actor, "assistant:use")).pipe(
          Effect.andThen(useCase),
          Effect.provideContext(ports)
        );

      return AssistantAudio.of({
        transcribe: (actor, mediaId, options) =>
          transcribe(actor, mediaId, options).pipe(
            Effect.provideContext(ports)
          ),
        transcriptionsStatus: (actor) =>
          reading(
            actor,
            openTranscriptionUse(actor.workspaceId).pipe(
              Effect.flatMap((use) =>
                statusOf(actor, "transcription", transcriptionsPerDay, use)
              )
            )
          ),
        voiceover: (actor, asked) =>
          voiceover(actor, asked).pipe(Effect.provideContext(ports)),
        voiceoversStatus: (actor) =>
          reading(
            actor,
            openSpeechUse(actor.workspaceId).pipe(
              Effect.flatMap((use) =>
                statusOf(actor, "speech", voiceoversPerDay, use)
              )
            )
          ),
      });
    })
  );
}
