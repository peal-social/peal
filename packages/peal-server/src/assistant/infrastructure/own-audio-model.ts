import { Duration, Effect, Layer } from "effect";

import { AudioFailed } from "#assistant/application/audio-failed.ts";
import { OwnAudioModel } from "#assistant/application/ports/own-audio-model.ts";
import {
  audioTimeout,
  maxVoiceoverBytes,
} from "#assistant/domain/audio-limits.ts";
import type {
  AudioCapability,
  AudioFailureReason,
} from "#assistant/domain/audio-use.ts";
import type { AudioCallFailed } from "#assistant/infrastructure/ai-sdk/audio-call-failed.ts";
import {
  generateSpeechWith,
  transcribeWith,
} from "#assistant/infrastructure/ai-sdk/audio-model.ts";
import { settingsRefused } from "#assistant/infrastructure/image-answers.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

/** The most a transcript's answer may carry: JSON or text, small. */
export const maxTranscriptAnswerBytes = 2 * 1024 * 1024;

const failWith =
  (capability: AudioCapability) => (kind: string, reason: AudioFailureReason) =>
    Effect.logWarning("A workspace's audio provider failed", {
      capability,
      kind,
      reason,
      source: "workspace",
    }).pipe(
      Effect.andThen(
        Effect.annotateCurrentSpan("peal.assistant.failure", kind)
      ),
      Effect.andThen(Effect.fail(new AudioFailed({ capability, reason })))
    );

/** What a status of the provider's API says, as a reason. */
export const reasonOfAudioStatus = (status: number): AudioFailureReason => {
  if (settingsRefused.has(status)) {
    return "settingsRefused";
  }

  if (status >= 300 && status <= 399) {
    return "redirected";
  }

  return status === 429 || status >= 500 ? "unreachable" : "refused";
};

const callFailed =
  (capability: AudioCapability) =>
  ({ kind, status }: AudioCallFailed): Effect.Effect<never, AudioFailed> => {
    const fail = failWith(capability);

    if (kind === "status" && status !== null) {
      return fail(`Status${status}`, reasonOfAudioStatus(status));
    }

    // The guard checked the address just before: a request it refuses as
    // it is sent (a name whose answer changed since) could not be sent.
    if (kind === "unsent") {
      return fail("Transport", "unreachable");
    }

    return kind === "unusable"
      ? fail("UnusableAnswer", "unusableAnswer")
      : fail("Refused", "refused");
  };

/**
 * OwnAudioModel on the AI SDK's adapter (`ai-sdk/audio-model.ts`), at the
 * address the workspace's connection keeps: the address is checked by the
 * outbound guard before the call, then every request goes through the
 * guarded fetch (`publicFetchWith`: the guard on each request, no
 * redirect, no trace context), its answers bounded at `maxVoiceoverBytes`
 * for speech and `maxTranscriptAnswerBytes` for transcripts. The whole
 * call waits `timeout`.
 *
 * 401 to 404 are `settingsRefused`, a 3xx `redirected`, 429 and 5xx
 * `unreachable`, another status `refused`, a request never sent
 * `unreachable`, an answer without audio or text `unusableAnswer`, the
 * wait over `timedOut`. It keeps no state: the provider's package is
 * built for each call. The logs and the span say `workspace`, the use,
 * the provider and the kind of failure, never the host, the model, the
 * text, the audio or the key.
 */
export const ownAudioModel = ({
  timeout = audioTimeout,
}: { readonly timeout?: Duration.Input } = {}) =>
  Layer.effect(
    OwnAudioModel,
    Effect.gen(function* makeOwnAudioModel() {
      const guard = yield* OutboundGuard;
      const bound = Duration.fromInputUnsafe(timeout);

      const speechFetch = yield* publicFetchWith({
        maxResponseBytes: maxVoiceoverBytes + 1,
        timeout: bound,
      });

      const transcriptFetch = yield* publicFetchWith({
        maxResponseBytes: maxTranscriptAnswerBytes,
        timeout: bound,
      });

      const guarded = (capability: AudioCapability, baseUrl: string) =>
        guard.check(new URL(baseUrl)).pipe(
          // The guard's span names the host it refuses.
          Effect.withTracerEnabled(false),
          Effect.catchTag(
            "OutboundRequestRefused",
            ({ reason }: OutboundRequestRefused) =>
              reason === "lookupFailed"
                ? failWith(capability)("Lookup", "unreachable")
                : failWith(capability)("AddressRefused", "addressRefused")
          )
        );

      const bounded = <A>(
        capability: AudioCapability,
        provider: string,
        call: Effect.Effect<A, AudioFailed>
      ) =>
        call.pipe(
          // Interrupting the call aborts its request.
          Effect.timeoutOrElse({
            duration: bound,
            orElse: () => failWith(capability)("Timeout", "timedOut"),
          }),
          Effect.withSpan(`OwnAudioModel.${capability}`, {
            attributes: {
              "gen_ai.provider.name": provider,
              "peal.assistant.audio_source": "workspace",
            },
          })
        );

      return OwnAudioModel.of({
        speak: (endpoint, { text, voice }) =>
          bounded(
            "speech",
            endpoint.provider,
            guarded("speech", endpoint.baseUrl).pipe(
              Effect.andThen(
                generateSpeechWith(endpoint, speechFetch, { text, voice }).pipe(
                  Effect.catchTag("AudioCallFailed", callFailed("speech"))
                )
              ),
              Effect.flatMap(({ bytes }) =>
                bytes.byteLength === 0 || bytes.byteLength > maxVoiceoverBytes
                  ? failWith("speech")("UnusableAnswer", "unusableAnswer")
                  : Effect.succeed({ bytes })
              )
            )
          ),
        transcribe: (endpoint, audio) =>
          bounded(
            "transcription",
            endpoint.provider,
            guarded("transcription", endpoint.baseUrl).pipe(
              Effect.andThen(
                transcribeWith(endpoint, transcriptFetch, audio).pipe(
                  Effect.catchTag(
                    "AudioCallFailed",
                    callFailed("transcription")
                  )
                )
              )
            )
          ),
      });
    })
  );

/**
 * OwnAudioModel as the server runs it: the guard resolves names with the
 * runtime's Dns, which the composition root provides.
 */
export const OwnAudioModelLive = ownAudioModel().pipe(
  Layer.provide(OutboundGuard.layer)
);
