import { Duration, Effect, Layer, Option } from "effect";

import { OwnVideoModel } from "#assistant/application/ports/own-video-model.ts";
import type {
  OwnVideoEndpoint,
  VideoRequest,
} from "#assistant/application/ports/own-video-model.ts";
import { VideoFailed } from "#assistant/application/video-failed.ts";
import type { VideoFailureReason } from "#assistant/domain/video-generation.ts";
import { maxVideoBytes, videoTimeout } from "#assistant/domain/video-limits.ts";
import type { VideoCallFailed } from "#assistant/infrastructure/ai-sdk/video-call-failed.ts";
import { generateVideoWith } from "#assistant/infrastructure/ai-sdk/video-model.ts";
import { settingsRefused } from "#assistant/infrastructure/image-answers.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

/** The most an answer of the provider's API may carry: JSON, small. */
export const maxVideoAnswerBytes = 1024 * 1024;

/** How long one request of the API waits: a start carries a first frame. */
const apiRequestTimeout = Duration.minutes(1);

/** How long the video's download waits: up to `maxVideoBytes`. */
const downloadTimeout = Duration.minutes(5);

const failWith = (kind: string, reason: VideoFailureReason) =>
  Effect.logWarning("A workspace's video provider failed", {
    kind,
    reason,
    source: "workspace",
  }).pipe(
    Effect.andThen(Effect.annotateCurrentSpan("peal.assistant.failure", kind)),
    Effect.andThen(Effect.fail(new VideoFailed({ reason })))
  );

// A host Peal sends nothing to is the workspace's to fix; one that cannot
// be looked up for now may answer later.
const guardRefused = ({ reason }: OutboundRequestRefused) =>
  reason === "lookupFailed"
    ? failWith("Lookup", "unreachable")
    : failWith("AddressRefused", "addressRefused");

/** What a status of the provider's API says, as a job's reason. */
export const reasonOfVideoStatus = (status: number): VideoFailureReason => {
  if (settingsRefused.has(status)) {
    return "settingsRefused";
  }

  if (status >= 300 && status <= 399) {
    return "redirected";
  }

  return status === 429 || status >= 500 ? "unreachable" : "refused";
};

const callFailed = ({
  kind,
  status,
}: VideoCallFailed): Effect.Effect<never, VideoFailed> => {
  if (kind === "status" && status !== null) {
    return failWith(`Status${status}`, reasonOfVideoStatus(status));
  }

  // The guard checked the address just before: a request it refuses as
  // it is sent (a name whose answer changed since) could not be sent.
  if (kind === "unsent") {
    return failWith("Transport", "unreachable");
  }

  return kind === "unusable"
    ? failWith("UnusableAnswer", "unusableAnswer")
    : failWith("Refused", "refused");
};

/**
 * OwnVideoModel on the AI SDK's adapter (`ai-sdk/video-model.ts`), at
 * the address the workspace's connection keeps: the address is checked by
 * the outbound guard before the call, then every request (the start, each
 * poll) goes through the guarded fetch (`publicFetchWith`: the guard on
 * each request, no redirect, the answer bounded at
 * `maxVideoAnswerBytes`, no trace context), and the video's download
 * through another, bounded at `maxVideoBytes`, whose redirects the SDK
 * follows, each checked by the guard. The whole call waits `timeout`.
 *
 * 401 to 404 are `settingsRefused`, a 3xx `redirected`, 429 and 5xx
 * `unreachable`, another status `refused`, a request never sent
 * `unreachable`, an operation the provider failed `refused`, an answer or
 * a download without a video `unusableAnswer`, the wait over `timedOut`.
 * It keeps no state: the provider's package is built for each call. The
 * key is `Redacted` until the request's header; the logs and the span say
 * `workspace`, the provider and the kind of failure, never the host, the
 * model, the prompt or the key.
 */
export const ownVideoModel = ({
  timeout = videoTimeout,
}: { readonly timeout?: Duration.Input } = {}) =>
  Layer.effect(
    OwnVideoModel,
    Effect.gen(function* makeOwnVideoModel() {
      const guard = yield* OutboundGuard;
      const bound = Duration.fromInputUnsafe(timeout);

      const fetches = {
        api: yield* publicFetchWith({
          maxResponseBytes: maxVideoAnswerBytes,
          timeout: apiRequestTimeout,
        }),
        download: yield* publicFetchWith({
          maxResponseBytes: maxVideoBytes + 1,
          timeout: downloadTimeout,
        }),
      };

      const generate = (endpoint: OwnVideoEndpoint, request: VideoRequest) =>
        guard.check(new URL(endpoint.baseUrl)).pipe(
          // The guard's span names the host it refuses.
          Effect.withTracerEnabled(false),
          Effect.catchTag("OutboundRequestRefused", guardRefused),
          Effect.andThen(
            generateVideoWith(endpoint, fetches, {
              durationSeconds: request.durationSeconds,
              image: request.image.pipe(Option.map(({ bytes }) => bytes)),
              maxBytes: maxVideoBytes,
              // The SDK waits longer than the call, so the call's own
              // bound ends it, as `timedOut`.
              pollFor: Duration.sum(bound, Duration.minutes(5)),
              prompt: request.prompt,
              ratio: request.ratio,
            }).pipe(Effect.catchTag("VideoCallFailed", callFailed))
          ),
          Effect.flatMap((bytes) =>
            bytes.byteLength === 0 || bytes.byteLength > maxVideoBytes
              ? failWith("UnusableAnswer", "unusableAnswer")
              : Effect.succeed(bytes)
          ),
          // Interrupting the call aborts its request, or its wait.
          Effect.timeoutOrElse({
            duration: bound,
            orElse: () => failWith("Timeout", "timedOut"),
          }),
          Effect.withSpan("OwnVideoModel.generate", {
            attributes: {
              "gen_ai.provider.name": endpoint.provider,
              "peal.assistant.video_source": "workspace",
            },
          })
        );

      return OwnVideoModel.of({ generate });
    })
  );

/**
 * OwnVideoModel as the server runs it: the guard resolves names with the
 * runtime's Dns, which the composition root provides.
 */
export const OwnVideoModelLive = ownVideoModel().pipe(
  Layer.provide(OutboundGuard.layer)
);
